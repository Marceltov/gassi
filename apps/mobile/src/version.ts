// The app's version (app.json), sent with wishes and bugs and with error reports.
import Constants from "expo-constants";

export const APP_VERSION = Constants.expoConfig?.version ?? "?";
