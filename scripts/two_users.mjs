#!/usr/bin/env node

import { execSync } from "node:child_process";

const EXP_BUNDLE_ID = "host.exp.Exponent";
const PROJECT_URL = process.env.EXPO_DEV_URL || "exp://127.0.0.1:8081";

function run(command, options = {}) {
  return execSync(command, {
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  }).trim();
}

function tryRun(command, options = {}) {
  try {
    return run(command, options);
  } catch (error) {
    return null;
  }
}

function listIphoneDevices() {
  const output = run("xcrun simctl list devices");
  return output
    .split("\n")
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(
        /^(iPhone [^(]+)\s+\(([0-9A-F-]{36})\)\s+\((Booted|Shutdown)\)$/i,
      );
      if (!match) return null;
      return {
        name: match[1],
        udid: match[2],
        state: match[3],
      };
    })
    .filter(Boolean);
}

function chooseTwoDevices(devices) {
  const booted = devices.filter((device) => device.state === "Booted");
  const shutdown = devices.filter((device) => device.state === "Shutdown");

  if (booted.length >= 2) {
    return [booted[0], booted[1]];
  }

  if (booted.length === 1) {
    const secondary = shutdown[0];
    if (!secondary) return [booted[0], null];
    return [booted[0], secondary];
  }

  if (shutdown.length >= 2) {
    return [shutdown[0], shutdown[1]];
  }

  if (shutdown.length === 1) {
    return [shutdown[0], null];
  }

  return [null, null];
}

function bootAndOpen(device) {
  if (!device) return;
  tryRun(`xcrun simctl boot '${device.udid}'`);
  tryRun(`open -na 'Simulator' --args -CurrentDeviceUDID '${device.udid}'`);
}

function launchExpoGo(device) {
  if (!device) return false;
  const result = tryRun(`xcrun simctl launch '${device.udid}' '${EXP_BUNDLE_ID}'`);
  return Boolean(result !== null);
}

function installExpoGoFromPrimary(primary, secondary) {
  if (!primary || !secondary) return false;
  const appPath = tryRun(
    `xcrun simctl get_app_container '${primary.udid}' '${EXP_BUNDLE_ID}' app`,
  );
  if (!appPath) return false;
  const install = tryRun(`xcrun simctl install '${secondary.udid}' '${appPath}'`);
  return install !== null;
}

function openProject(device) {
  if (!device) return;
  tryRun(`xcrun simctl openurl '${device.udid}' '${PROJECT_URL}'`);
}

function main() {
  const devices = listIphoneDevices();
  const [primary, secondary] = chooseTwoDevices(devices);

  if (!primary || !secondary) {
    console.error("Need at least two iPhone simulators available.");
    process.exit(1);
  }

  bootAndOpen(primary);
  bootAndOpen(secondary);

  const primaryLaunched = launchExpoGo(primary);
  if (!primaryLaunched) {
    console.error("Could not launch Expo Go on primary simulator.");
    process.exit(1);
  }

  let secondaryLaunched = launchExpoGo(secondary);
  if (!secondaryLaunched) {
    const installed = installExpoGoFromPrimary(primary, secondary);
    if (installed) {
      secondaryLaunched = launchExpoGo(secondary);
    }
  }

  if (!secondaryLaunched) {
    console.error("Could not launch Expo Go on secondary simulator.");
    process.exit(1);
  }

  openProject(primary);
  openProject(secondary);

  console.log("two_users ready");
  console.log(`primary:   ${primary.name} (${primary.udid})`);
  console.log(`secondary: ${secondary.name} (${secondary.udid})`);
  console.log(`project:   ${PROJECT_URL}`);
  console.log("next: sign into one as trainer and the other as coordinator");
}

main();
