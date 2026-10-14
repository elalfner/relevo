// Finds the Android application id of the project under review, so the log audit can ignore other apps.

const GRADLE = [/applicationId\s*=\s*["']([\w.]+)["']/, /applicationId\s+["']([\w.]+)["']/];

/** Application id from the text of android/app/build.gradle or build.gradle.kts, or null. */
export function applicationId(gradleText) {
  for (const re of GRADLE) {
    const m = re.exec(String(gradleText));
    if (m) return m[1];
  }
  return null;
}
