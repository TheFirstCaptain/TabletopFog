# Network Troubleshooting Notes

Use this document during Milestone 1 and later local connectivity testing.

## Common Failure Modes

### Wrong LAN IP

The iPad must use the GM machine's current LAN IP address, not `localhost`.

Example:

```text
https://192.168.1.42:3000/player
```

If the GM changes Wi-Fi networks, the LAN IP may change.

### Guest Wi-Fi or LAN Isolation

Some home, school, hotel, and guest networks block device-to-device traffic. In that case, the iPad may not reach the GM machine even though both devices have internet access.

Validation should record this as a network limitation, not an app failure, unless the same setup works with other local servers but not TabletopFog.

### Firewall Prompt

The GM machine may block incoming connections until the user allows the Node.js server through the firewall.

Document the exact prompt and action required for Chromebook or MacBook once observed.

### Chromebook Linux Port Forwarding

On Chromebook, `npm run dev` runs inside the Linux development environment. The Chromebook browser may be able to reach the server locally while other devices on the Wi-Fi network cannot.

If `https://localhost:3000/player` works on the Chromebook but `https://<CHROMEBOOK-WIFI-LAN-IP>:3000/player` reports that the IP refused to connect, check ChromeOS Linux port forwarding for TCP port `3000`.

If the GM page works on the Chromebook but the iPad or another Chromebook cannot open the player page, check the same ChromeOS Linux port forwarding setting.

`https://penguin.linux.test:3000/player` working confirms the server is reachable through ChromeOS's Linux hostname, but it does not prove the service is reachable from other Wi-Fi devices. Test the Chromebook Wi-Fi LAN IP from a separate device on the same network.

If the iPad can open `https://<CHROMEBOOK-WIFI-LAN-IP>:3000/player` but the Chromebook itself cannot open that same Wi-Fi IP URL, treat the Chromebook-local failure as a ChromeOS loopback limitation. Use `https://localhost:3000/player` or `https://penguin.linux.test:3000/player` on the Chromebook, and use the Wi-Fi LAN IP from separate player devices.

To inspect the listening port while `npm run dev` is running, open a second Linux terminal tab or window and run:

```sh
ss -ltnp | grep ':3000'
```

Also confirm the URL and certificate use the Chromebook's Wi-Fi LAN IP address, not the Linux container IP. Regenerate the certificate with the Chromebook Wi-Fi LAN IP:

```sh
npm run cert -- --ip=<CHROMEBOOK-WIFI-LAN-IP>
```

### Certificate Trust Failure

Because HTTPS is mandatory, iPad Safari may warn about or reject a local development certificate. Follow the certificate setup documented during F-002.

If the browser blocks the page:

- Confirm the certificate includes the LAN IP address.
- Confirm the certificate was regenerated after the LAN IP changed.
- Confirm the iPad trust steps were completed.
- Record the browser message in the feature or bug document.

### VPN or Private Relay

VPNs, iCloud Private Relay, security tools, or managed-device profiles may interfere with local network access. Disable them temporarily during validation if appropriate.

## What to Record

For connectivity issues, record:

- GM device and OS.
- Player device and browser.
- Wi-Fi network type.
- GM LAN IP.
- URL used on the iPad.
- Whether HTTPS certificate trust was completed.
- Exact browser or terminal error.
- Whether another local server can be reached from the iPad.
