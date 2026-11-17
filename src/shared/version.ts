declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

/** The commit this build came from, to 7 characters. `dev` outside a git checkout. */
export const BUILD_ID: string = __APP_VERSION__.slice(0, 7);

/** When it was built, UTC, as `MM-DD HH:MM`. */
export const BUILD_TIME: string = __BUILD_TIME__;

/** The line shown in the game and the dev overlay, for example `7c3f1a2 11-17 14:02`. */
export const BUILD_LABEL = `${BUILD_ID} ${BUILD_TIME}`;
