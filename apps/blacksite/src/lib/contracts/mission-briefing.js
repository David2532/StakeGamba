import { MODES, getModeActionDescription, getModeLabel } from './modes.js';
import { RULES_CONTRACT } from './rules.js';

const COPY = Object.freeze({
	en: Object.freeze({
		eyebrow: 'SECURE OPERATIONS DOSSIER',
		title: 'MISSION BRIEFING',
		mission: 'YOUR MISSION',
		features: 'BLACKOUT FEATURES',
		intel: 'CLASSIFIED INTEL',
		modes: 'ENTRY MODES',
		grid: ({ columns, rows, paylines, minimumMatch }) =>
			`The board has ${columns} reels and ${rows} rows. All ${paylines} fixed paylines are always active. Land ${minimumMatch}, 4 or 5 consecutive matching symbols on a line, starting from the leftmost reel. Multiple winning lines are added together. There are no tumbles or cascades.`,
		stake: (social) => social
			? 'Set your play amount and select an entry mode. Total play equals the play amount multiplied by the selected mode cost.'
			: 'Set your base bet and select an entry mode. Total play equals the base bet multiplied by the selected mode cost.',
		wildTitle: 'GHOST WILD',
		wild: 'Substitutes for any of the 11 regular symbols and can also pay as itself. It never substitutes for VAULT.',
		breachTitle: 'VAULT',
		breach: ({ spins }) => `VAULT has no line payout. Land VAULT on at least 3 different reels of the opening spin to award exactly ${spins} BLACKOUT free spins.`,
		targetTitle: 'EXPANDING TARGET',
		target: ({ spins, paylines }) => `At the start of BLACKOUT, one regular symbol is selected as the target for all ${spins} free spins. Before each free-spin payout evaluation, every reel containing that target on the original board expands to fill all 3 rows. Wins are then evaluated on the same ${paylines} fixed paylines. BLACKOUT cannot retrigger.`,
		rtp: 'RTP',
		maxWin: 'MAXIMUM COMPLETE-ROUND PAYOUT',
		maxWinSuffix: '× BASE BET',
		details: 'DETAILS / PAYTABLE',
		detailsClose: 'CLOSE PAYTABLE',
		responsible: 'All outcomes are randomly determined and independent of previous plays. Play responsibly.',
		cta: 'MISSION START',
		introReplay: 'REPLAY INTRO',
		briefingReplay: 'OPEN MISSION BRIEFING',
		introStartup: 'PLAY INTRO ON STARTUP',
		on: 'ON',
		off: 'OFF',
	}),
	de: Object.freeze({
		eyebrow: 'GESICHERTES EINSATZDOSSIER',
		title: 'MISSIONSBRIEFING',
		mission: 'DEIN AUFTRAG',
		features: 'BLACKOUT-FEATURES',
		intel: 'GEHEIME INFORMATIONEN',
		modes: 'EINSTIEGSMODI',
		grid: ({ columns, rows, paylines, minimumMatch }) =>
			`Das Spielfeld besteht aus ${columns} Walzen und ${rows} Reihen. Alle ${paylines} festen Gewinnlinien sind immer aktiv. Für einen Liniengewinn müssen ${minimumMatch}, 4 oder 5 gleiche Symbole ab der linken Walze ohne Unterbrechung auf einer Gewinnlinie liegen. Mehrere Liniengewinne werden addiert. Es gibt keine Tumbles oder Kaskaden.`,
		stake: (social) => social
			? 'Lege deinen Spielbetrag fest und wähle einen Einstiegsmodus. Das Gesamtspiel entspricht dem Spielbetrag multipliziert mit den Moduskosten.'
			: 'Lege deinen Basiseinsatz fest und wähle einen Einstiegsmodus. Der Gesamteinsatz entspricht dem Basiseinsatz multipliziert mit den Moduskosten.',
		wildTitle: 'GHOST WILD',
		wild: 'Ersetzt jedes der 11 regulären Symbole und kann auch selbst auszahlen. GHOST WILD ersetzt niemals VAULT.',
		breachTitle: 'VAULT',
		breach: ({ spins }) => `VAULT besitzt keine Linienauszahlung. Landen im Eröffnungsspin mindestens 3 VAULT-Symbole auf verschiedenen Walzen, werden genau ${spins} BLACKOUT-Freispiele vergeben.`,
		targetTitle: 'EXPANDING TARGET',
		target: ({ spins, paylines }) => `Zu Beginn von BLACKOUT wird eines der regulären Symbole als Ziel für alle ${spins} Freispiele gewählt. Vor jeder Gewinnbewertung wird jede Walze, auf der dieses Ziel im ursprünglichen Freispielbild liegt, vollständig mit 3 Zielsymbolen gefüllt. Anschließend werden dieselben ${paylines} festen Gewinnlinien ausgewertet. BLACKOUT kann nicht erneut ausgelöst werden.`,
		rtp: 'RTP',
		maxWin: 'MAXIMALE AUSZAHLUNG DER VOLLSTÄNDIGEN RUNDE',
		maxWinSuffix: '× BASISEINSATZ',
		details: 'DETAILS / AUSZAHLUNGSTABELLE',
		detailsClose: 'AUSZAHLUNGSTABELLE SCHLIESSEN',
		responsible: 'Alle Ergebnisse werden zufällig und unabhängig voneinander bestimmt. Spiele verantwortungsvoll.',
		cta: 'MISSION STARTEN',
		introReplay: 'INTRO ERNEUT ANSEHEN',
		briefingReplay: 'MISSIONSBRIEFING ÖFFNEN',
		introStartup: 'INTRO BEIM START ABSPIELEN',
		on: 'AN',
		off: 'AUS',
	}),
});

function localeFor(language) {
	return typeof language === 'string' && /^de(?:-|$)/iu.test(language) ? 'de' : 'en';
}

export function createMissionBriefing({ language = 'en', social = false } = {}) {
	const locale = localeFor(language);
	const copy = COPY[locale];
	const presentedCopy = social
		? Object.freeze({
			...copy,
			wild: locale === 'de'
				? 'Ersetzt jedes der 11 regulären Symbole und kann auch selbst einen Liniengewinn bilden. GHOST WILD ersetzt niemals VAULT.'
				: 'Substitutes for any of the 11 regular symbols and can also form a line award itself. It never substitutes for VAULT.',
			breach: locale === 'de'
				? ({ spins }) => `VAULT besitzt keinen Liniengewinn. Landen im Eröffnungsspin mindestens 3 VAULT-Symbole auf verschiedenen Walzen, werden genau ${spins} BLACKOUT-Freispiele vergeben.`
				: ({ spins }) => `VAULT has no line award. Land VAULT on at least 3 different reels of the opening spin to award exactly ${spins} BLACKOUT free spins.`,
			target: locale === 'de'
				? ({ spins, paylines }) => `Zu Beginn von BLACKOUT wird eines der regulären Symbole als Ziel für alle ${spins} Freispiele gewählt. Vor jeder Freispiel-Gewinnbewertung wird jede Walze, auf der dieses Ziel im ursprünglichen Bild liegt, vollständig mit 3 Zielsymbolen gefüllt. Anschließend werden dieselben ${paylines} festen Gewinnlinien ausgewertet. BLACKOUT kann nicht erneut ausgelöst werden.`
				: ({ spins, paylines }) => `At the start of BLACKOUT, one regular symbol is selected as the target for all ${spins} free spins. Before each free-spin result evaluation, every reel containing that target on the original board expands to fill all 3 rows. Wins are then evaluated on the same ${paylines} fixed paylines. BLACKOUT cannot retrigger.`,
			maxWin: locale === 'de'
				? 'MAXIMALER GEWINN DER VOLLSTÄNDIGEN RUNDE'
				: 'MAXIMUM COMPLETE-ROUND WIN',
			maxWinSuffix: locale === 'de' ? '× SPIELBETRAG' : '× PLAY AMOUNT',
		})
		: copy;
	const board = RULES_CONTRACT.board;
	const facts = Object.freeze({
		columns: board.columns,
		rows: board.rows,
		paylines: board.paylines,
		minimumMatch: board.minimumMatch,
		spins: RULES_CONTRACT.initialFeatureSpins,
	});
	const modes = MODES.map((mode) => Object.freeze({
		id: mode.id,
		label: getModeLabel(mode.id, social),
		costMultiplier: mode.costMultiplier,
		description: locale === 'de'
			? {
				base: 'Startet das normale Basisspiel.',
				deep_access: 'Garantiert im Eröffnungsspin zwei VAULT-Symbole auf verschiedenen Walzen. Ein drittes VAULT auf einer weiteren Walze löst BLACKOUT aus.',
				blackout: `Startet direkt mit den ${facts.spins} BLACKOUT-Freispielen und einem expandierenden regulären Zielsymbol.`,
			}[mode.id]
			: getModeActionDescription(mode.id, social),
	}));

	return Object.freeze({
		locale,
		copy: presentedCopy,
		facts,
		missionCopy: Object.freeze([presentedCopy.stake(social), presentedCopy.grid(facts)]),
		features: Object.freeze([
			Object.freeze({ id: 'wild', title: presentedCopy.wildTitle, copy: presentedCopy.wild }),
			Object.freeze({ id: 'breach', title: presentedCopy.breachTitle, copy: presentedCopy.breach(facts) }),
			Object.freeze({ id: 'target', title: presentedCopy.targetTitle, copy: presentedCopy.target(facts) }),
		]),
		modes: Object.freeze(modes),
		rtpPercent: RULES_CONTRACT.targetRtp * 100,
		maxWinMultiplier: RULES_CONTRACT.maxWinRaw / 100,
	});
}

export function missionBriefingControls(language = 'en') {
	const copy = COPY[localeFor(language)];
	return Object.freeze({
		introReplay: copy.introReplay,
		briefingReplay: copy.briefingReplay,
		introStartup: copy.introStartup,
		on: copy.on,
		off: copy.off,
	});
}
