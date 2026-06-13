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
