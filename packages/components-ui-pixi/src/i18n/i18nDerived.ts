import { stateI18nDerived } from 'state-shared';

export const i18nDerived = {
	audio: () => stateI18nDerived.translate('AUDIO'),
	balance: () => stateI18nDerived.translate('BALANCE'),
	win: () => stateI18nDerived.translate('WIN'),
	bet: () => stateI18nDerived.translate('PLAY'),
	stop: () => stateI18nDerived.translate('STOP'),
	buyBonus: () => stateI18nDerived.translate('BONUS / FEATURE'),
	disable: () => stateI18nDerived.translate('DISABLE'),
	freeSpins: () => stateI18nDerived.translate('FREE SPINS'),
	//
	decrease: () => stateI18nDerived.translate('-'),
	increase: () => stateI18nDerived.translate('+'),
	menu: () => stateI18nDerived.translate('MENU'),
	turbo: () => stateI18nDerived.translate('TURBO'),
	autoSpin: () => stateI18nDerived.translate('AUTO-PLAY'),
	payTable: () => stateI18nDerived.translate('SYMBOL TABLE'),
	info: () => stateI18nDerived.translate('INFO'),
	settings: () => stateI18nDerived.translate('SETTINGS'),
	soundOn: () => stateI18nDerived.translate('SOUND ON'),
	soundOff: () => stateI18nDerived.translate('SOUND OFF'),
	menuExit: () => stateI18nDerived.translate('EXIT'),
};
