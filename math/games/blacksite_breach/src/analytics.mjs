import { MAX_WIN_RAW, TARGET_RTP, VERIFICATION_PROFILE } from './config.mjs';
import { mixSeed, xorshift32 } from './model.mjs';

function quantileSorted(sorted, probability) {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const fraction = position - lower;
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

function quantileObject(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    p00: quantileSorted(sorted, 0),
    p01: quantileSorted(sorted, 0.01),
    p05: quantileSorted(sorted, 0.05),
    p10: quantileSorted(sorted, 0.1),
    p50: quantileSorted(sorted, 0.5),
    p90: quantileSorted(sorted, 0.9),
    p95: quantileSorted(sorted, 0.95),
    p99: quantileSorted(sorted, 0.99),
    p9999: quantileSorted(sorted, 0.9999),
    p100: quantileSorted(sorted, 1),
  };
}

function sampleStats(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.length < 2
    ? 0
    : values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  const standardDeviation = Math.sqrt(variance);
  return {
    replicates: values.length,
    mean: round(mean),
    standard_deviation: round(standardDeviation),
    monte_carlo_standard_error: round(standardDeviation / Math.sqrt(values.length)),
    quantiles: Object.fromEntries(Object.entries(quantileObject(values)).map(([key, value]) => [key, round(value)])),
  };
}

function round(value, places = 12) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function mostCommon(payouts, limit = 10) {
  const counts = new Map();
  for (const payout of payouts) counts.set(payout, (counts.get(payout) ?? 0) + 1);
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])
    .slice(0, limit)
    .map(([payoutRaw, count]) => ({ payout_raw: payoutRaw, count, probability: count / payouts.length }));
}

function payoutBands(payouts, cost, totalPayoutRaw) {
  const bands = [
    { id: 'zero', minimum: 0, maximum: 0 },
    { id: 'gt_0_lt_1x_cost', minimum: Number.MIN_VALUE, maximum: 1 },
    { id: '1_to_lt_2x_cost', minimum: 1, maximum: 2 },
    { id: '2_to_lt_5x_cost', minimum: 2, maximum: 5 },
    { id: '5_to_lt_20x_cost', minimum: 5, maximum: 20 },
    { id: '20_to_lt_50x_cost', minimum: 20, maximum: 50 },
    { id: '50_to_lt_100x_cost', minimum: 50, maximum: 100 },
    { id: '100_to_lt_1000x_cost', minimum: 100, maximum: 1000 },
    { id: 'gte_1000x_cost', minimum: 1000, maximum: Infinity },
  ];
  return bands.map((band) => {
    let count = 0;
    let payoutRaw = 0;
    for (const payout of payouts) {
      const normalized = payout / (100 * cost);
      const match = band.id === 'zero'
        ? payout === 0
        : normalized >= band.minimum && normalized < band.maximum;
      if (match) {
        count += 1;
        payoutRaw += payout;
      }
    }
    return {
      id: band.id,
      books: count,
      probability: count / payouts.length,
      payout_raw_contribution: payoutRaw,
      rtp_contribution_share: totalPayoutRaw === 0 ? 0 : payoutRaw / totalPayoutRaw,
    };
  });
}

const WINDOW_SPECS = [
  { bets: 100, trials: 1000 },
  { bets: 1000, trials: 1000 },
  { bets: 5000, trials: 500 },
  { bets: 10000, trials: 200 },
  { bets: 100000, trials: 100 },
];

export function shortWindowRisk(mode, payouts) {
  const normalizedPopulation = payouts.map((payout) => payout / (100 * mode.cost));
  const exactMean = normalizedPopulation.reduce((sum, value) => sum + value, 0) / normalizedPopulation.length;
  const exactVariance = normalizedPopulation.reduce((sum, value) => sum + (value - exactMean) ** 2, 0) / normalizedPopulation.length;
  return WINDOW_SPECS.map(({ bets, trials }) => {
    const rng = xorshift32(mixSeed(mode.generation_seed, bets, trials, 0x51a7));
    const playerRtps = [];
    const ggrs = [];
    const largestShares = [];
    const concentration20 = [];
    const concentration50 = [];
    const concentration100 = [];
    let negativeGgr = 0;
    for (let trial = 0; trial < trials; trial += 1) {
      let normalizedTotal = 0;
      let largest = 0;
      let over20 = 0;
      let over50 = 0;
      let over100 = 0;
      for (let index = 0; index < bets; index += 1) {
        const payoutRaw = payouts[rng() % payouts.length];
        const normalized = payoutRaw / (100 * mode.cost);
        normalizedTotal += normalized;
        largest = Math.max(largest, normalized);
        if (normalized >= 20) over20 += normalized;
        if (normalized >= 50) over50 += normalized;
        if (normalized >= 100) over100 += normalized;
      }
      const playerRtp = normalizedTotal / bets;
      const ggr = 1 - playerRtp;
      playerRtps.push(playerRtp);
      ggrs.push(ggr);
      largestShares.push(normalizedTotal === 0 ? 0 : largest / normalizedTotal);
      concentration20.push(normalizedTotal === 0 ? 0 : over20 / normalizedTotal);
      concentration50.push(normalizedTotal === 0 ? 0 : over50 / normalizedTotal);
      concentration100.push(normalizedTotal === 0 ? 0 : over100 / normalizedTotal);
      if (ggr < 0) negativeGgr += 1;
    }
    return {
      bets,
      trials,
      rng_seed: mixSeed(mode.generation_seed, bets, trials, 0x51a7),
      exact_iid_window_expectation: {
        player_rtp_mean: exactMean,
        operator_ggr_mean: 1 - exactMean,
        player_rtp_standard_deviation: Math.sqrt(exactVariance / bets),
        operator_ggr_standard_deviation: Math.sqrt(exactVariance / bets),
      },
      player_rtp: sampleStats(playerRtps),
      operator_ggr: sampleStats(ggrs),
      probability_negative_operator_ggr: negativeGgr / trials,
      largest_payout_share_of_window_return: Object.fromEntries(Object.entries(quantileObject(largestShares)).map(([key, value]) => [key, round(value)])),
      return_concentration_gte_20x_cost: Object.fromEntries(Object.entries(quantileObject(concentration20)).map(([key, value]) => [key, round(value)])),
      return_concentration_gte_50x_cost: Object.fromEntries(Object.entries(quantileObject(concentration50)).map(([key, value]) => [key, round(value)])),
      return_concentration_gte_100x_cost: Object.fromEntries(Object.entries(quantileObject(concentration100)).map(([key, value]) => [key, round(value)])),
    };
  });
}

export function summarizeDistribution(mode, payoutValues, packageFacts) {
  const payouts = [...payoutValues];
  const sortedRaw = [...payouts].sort((left, right) => left - right);
  const normalized = payouts.map((payout) => payout / (100 * mode.cost));
  const sortedNormalized = [...normalized].sort((left, right) => left - right);
  const count = payouts.length;
  const totalPayoutRaw = payouts.reduce((sum, payout) => sum + payout, 0);
  const meanNormalized = normalized.reduce((sum, value) => sum + value, 0) / count;
  const varianceNormalized = normalized.reduce((sum, value) => sum + (value - meanNormalized) ** 2, 0) / count;
  const standardDeviationNormalized = Math.sqrt(varianceNormalized);
  const hitCount = payouts.filter((payout) => payout > 0).length;
  const maxCount = payouts.filter((payout) => payout === MAX_WIN_RAW).length;
  const distinctRawPayoutValues = new Set(payouts).size;
  const distinctPositiveRawPayoutValues = new Set(payouts.filter((payout) => payout > 0)).size;
  const worstCount = Math.max(1, Math.ceil(count * 0.001));
  const worstRaw = sortedRaw.slice(-worstCount);
  const cvarRawHuman = worstRaw.reduce((sum, payout) => sum + payout / 100, 0) / worstCount;
  const cvarNormalized = worstRaw.reduce((sum, payout) => sum + payout / (100 * mode.cost), 0) / worstCount;
  const sumAbove40Cost = payouts.filter((payout) => payout > 40 * 100 * mode.cost).reduce((sum, payout) => sum + payout, 0);
  const sumAbove10000Cost = payouts.filter((payout) => payout > 10000 * 100 * mode.cost).reduce((sum, payout) => sum + payout, 0);
  const raw5000Count = payouts.filter((payout) => payout >= 5000 * 100).length;
  const raw10000Count = payouts.filter((payout) => payout >= 10000 * 100).length;
  const achievedRtp = totalPayoutRaw / (100 * mode.cost * count);

  const summary = {
    mode: mode.name,
    cost_multiplier: mode.cost,
    books: count,
    weight_per_book: 1,
    target_rtp: TARGET_RTP,
    achieved_rtp: achievedRtp,
    rtp_error: achievedRtp - TARGET_RTP,
    total_payout_raw: totalPayoutRaw,
    payout_unit: 'centi-x_uint64',
    hit_count: hitCount,
    hit_rate: hitCount / count,
    zero_count: count - hitCount,
    zero_rate: 1 - hitCount / count,
    distinct_raw_payout_values: distinctRawPayoutValues,
    distinct_positive_raw_payout_values: distinctPositiveRawPayoutValues,
    mean_cost_normalized_return: meanNormalized,
    median_cost_normalized_return: quantileSorted(sortedNormalized, 0.5),
    variance_cost_normalized_return: varianceNormalized,
    standard_deviation_cost_normalized_return: standardDeviationNormalized,
    coefficient_of_variation: meanNormalized === 0 ? 0 : standardDeviationNormalized / meanNormalized,
    quantiles_cost_normalized_return: {
      p01: quantileSorted(sortedNormalized, 0.01),
      p05: quantileSorted(sortedNormalized, 0.05),
      p00: quantileSorted(sortedNormalized, 0),
      p10: quantileSorted(sortedNormalized, 0.1),
      p25: quantileSorted(sortedNormalized, 0.25),
      p50: quantileSorted(sortedNormalized, 0.5),
      p75: quantileSorted(sortedNormalized, 0.75),
      p95: quantileSorted(sortedNormalized, 0.95),
      p90: quantileSorted(sortedNormalized, 0.9),
      p99: quantileSorted(sortedNormalized, 0.99),
      p999: quantileSorted(sortedNormalized, 0.999),
      p9999: quantileSorted(sortedNormalized, 0.9999),
      p100: quantileSorted(sortedNormalized, 1),
    },
    observed_max_raw: sortedRaw.at(-1),
    observed_max_human_x: sortedRaw.at(-1) / 100,
    max_win_book_count: maxCount,
    max_win_probability: maxCount / count,
    max_win_odds_one_in: maxCount === 0 ? null : count / maxCount,
    effective_sample_size: count,
    top_single_book_selection_share: 1 / count,
    cvar_worst_0_1_percent: {
      books: worstCount,
      cost_normalized_return: cvarNormalized,
      raw_human_x: cvarRawHuman,
    },
    tail: {
      etl_rtp_share_above_40x_cost: totalPayoutRaw === 0 ? 0 : sumAbove40Cost / totalPayoutRaw,
      etl_rtp_share_above_10000x_cost: totalPayoutRaw === 0 ? 0 : sumAbove10000Cost / totalPayoutRaw,
      probability_raw_human_at_or_above_5000x: raw5000Count / count,
      probability_raw_human_at_or_above_10000x: raw10000Count / count,
      source_scale_ambiguity_checked_as_fraction_and_percent: true,
    },
    payout_bands_cost_normalized: payoutBands(payouts, mode.cost, totalPayoutRaw),
    most_common_final_payouts: mostCommon(payouts),
    package: packageFacts,
  };

  const hard = VERIFICATION_PROFILE.hard_gates;
  const star = VERIFICATION_PROFILE.three_star_review_bands;
  const gateResults = {
    rtp_in_official_range: achievedRtp >= hard.rtp_min && achievedRtp <= hard.rtp_max,
    rtp_matches_candidate_target_exactly: achievedRtp === TARGET_RTP,
    nonzero_hit_rate: hitCount / count >= hard.minimum_nonzero_hit_rate,
    max_win_present_positive_weight: maxCount > 0,
    max_win_within_hard_limit: sortedRaw.at(-1) / 100 <= hard.maximum_win_human_x,
    mode_cost_within_hard_limit: mode.cost <= hard.maximum_mode_cost,
    payout_within_3star_review_band: sortedRaw.at(-1) / 100 <= star.maximum_payout_human_x,
    cost_within_3star_review_band: mode.cost <= star.maximum_cost,
    candidate_book_count: count >= hard.minimum_candidate_books_per_mode && count <= hard.maximum_books_per_mode,
    compressed_book_file_size: packageFacts.compressed_book_bytes <= hard.maximum_compressed_book_bytes,
    event_count: packageFacts.event_count <= hard.maximum_events_per_mode,
    max_win_odds_internal_realism_target: maxCount > 0 && count / maxCount <= 9000000,
    effective_sample_size_ratio: count / count >= 0.95,
    top_single_book_selection_share: 1 / count <= 0.00001,
    cvar_cost_normalized_3star: cvarNormalized <= star.maximum_cvar_worst_0_1_percent_cost_normalized,
    cvar_raw_human_3star: cvarRawHuman <= star.maximum_cvar_worst_0_1_percent_raw_human_x,
    etl_above_40x_cost_3star: summary.tail.etl_rtp_share_above_40x_cost <= star.maximum_etl_rtp_share_above_40x_cost,
    etl_above_10000x_cost_3star: summary.tail.etl_rtp_share_above_10000x_cost <= star.maximum_etl_rtp_share_above_10000x_cost,
    etl_combined_score_3star: summary.tail.etl_rtp_share_above_40x_cost + summary.tail.etl_rtp_share_above_10000x_cost <= star.maximum_etl_combined_score,
    raw_tail_5000x_fraction_scale: summary.tail.probability_raw_human_at_or_above_5000x <= star.maximum_probability_raw_at_or_above_5000x_fraction_scale,
    raw_tail_10000x_fraction_scale: summary.tail.probability_raw_human_at_or_above_10000x <= star.maximum_probability_raw_at_or_above_10000x_fraction_scale,
    raw_tail_5000x_stricter_percent_scale: summary.tail.probability_raw_human_at_or_above_5000x <= star.maximum_probability_raw_at_or_above_5000x_stricter_percent_scale,
    raw_tail_10000x_stricter_percent_scale: summary.tail.probability_raw_human_at_or_above_10000x <= star.maximum_probability_raw_at_or_above_10000x_stricter_percent_scale,
    project_positive_raw_payout_diversity: distinctPositiveRawPayoutValues >= VERIFICATION_PROFILE.project_candidate_gates.minimum_distinct_positive_raw_payout_values_per_mode,
  };
  return { summary, gateResults };
}

export function operatorTemplateProbe(modes) {
  const probe = VERIFICATION_PROFILE.operator_template_probe;
  const modeResults = modes.map((mode) => {
    const maximumTotalBetCost = probe.base_amount_usd_max * mode.cost;
    const maximumPossiblePayout = probe.base_amount_usd_max * (MAX_WIN_RAW / 100);
    return {
      mode: mode.name,
      base_amount_usd_range: [probe.base_amount_usd_min, probe.base_amount_usd_max],
      maximum_total_bet_cost_usd: maximumTotalBetCost,
      maximum_possible_payout_usd: maximumPossiblePayout,
      passes_total_bet_cost_limit: maximumTotalBetCost <= probe.maximum_total_bet_cost_usd,
      passes_possible_payout_limit: maximumPossiblePayout <= probe.maximum_possible_payout_usd,
    };
  });
  return { mode_results: modeResults, viable: modeResults.every((result) => result.passes_total_bet_cost_limit && result.passes_possible_payout_limit) };
}
