# Rhenium Privacy Policy

Effective date: 18 October 2026

Rhenium is an independent, open-source browser for Android TV and Google TV,
maintained by the smolcars Rhenium project. This policy covers the Rhenium Android
app (`com.nitesh.rhenium`), including its optional phone remote. For privacy
questions or requests, contact **rhenium-support@proton.me**.

## Browser data on your device

Rhenium processes the addresses, searches and page content needed to browse the
web. Normal browsing can store history, tabs, bookmarks, cookies, site storage,
cached files, downloads and preferences on your device. The project does not
receive a copy of your browsing history, bookmarks, passwords or page contents.
Rhenium does not require a Rhenium account.

Use the browser menu's **Settings → Clear browsing data** controls to clear
history, site data or cache. Bookmarks and downloads have separate removal
controls; downloaded files can remain on the device after browsing data is
cleared. Android's app storage controls can clear the app's local data.

Private tabs keep their browsing session separate from normal browsing. Private
browsing does not make you anonymous to websites, your internet provider or
others operating your network. Files you download or items you explicitly save
can remain after a private session ends.

## Websites and search providers

When you visit a website, Rhenium connects to that website and the services it
loads. They can receive your IP address, browser information, requested address,
cookies and information you submit. Searches are sent to your selected search
provider. Signing into a website shares information with that website, rather
than creating a Rhenium account. Those services have their own privacy policies,
retention periods and deletion procedures.

Ad and tracker blocking reduces some requests but cannot prevent every form of
tracking. HTTPS protects connections to supporting websites; ordinary HTTP
connections are unencrypted. Network and DNS providers also process connection
information needed to reach websites.

## Analytics and browser updates

Rhenium's Android build disables Brave usage pings, P3A analytics, Web Discovery
reporting and automatic crash-report uploads. The project does not use an
advertising SDK or sell browsing information. Local browser diagnostics may
still be generated on the device.

The browser checks for signed ad-block filter updates from GitHub, automatically
after startup and at most daily, or when you request a check. These requests use
HTTPS and do not include your account, cookies or browsing history. GitHub and
its delivery providers receive connection information such as your IP address
and request headers. Retained upstream browser components may also contact
Brave or other component providers to check for browser resources. These
providers handle server logs under their own policies. See
[GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)
and [Brave's privacy policy](https://brave.com/privacy/browser/).

Google Play and Android may separately process installation, update and device
diagnostic information under your Google and device settings. That processing
is governed by their policies.

## Optional phone remote

Phone controls work between your phone's browser and the TV on the same local
network, after you approve pairing on the TV. The connection exchanges pairing
and session information, remote commands, entered text and the browser state
needed to operate the remote. The project does not operate a relay server for
this feature.

**The phone remote currently uses unencrypted local HTTP.** Other parties with
access to that network may be able to observe the connection. Use a trusted
network and avoid entering passwords or sensitive information through the
remote. Private browsing does not encrypt this connection. Use **Disconnect**
in the Phone panel when finished.

## Permissions

Rhenium uses network access to load websites, download browser resources and
provide the optional local phone connection. Websites can request capabilities
such as camera, microphone or location access through browser and Android
permission prompts, where supported. Information you choose to provide to a
website is handled by that website. You can manage app permissions in Android
settings.

The browser can query installed apps to find an app that can handle a website
link or a file you choose to open. This matching happens on your device; the
project does not collect or upload your installed-app inventory. If you download
an APK and choose to open it, Android controls installation and any permission
to install apps from this source. Rhenium does not silently install apps.

Foreground services or user-initiated jobs can keep user-requested downloads
and media playback running while you use another app. Android notifications
and permissions govern these activities. Websites can request microphone
access while Rhenium is open; microphone content you authorize a website to
use is handled by that website. Rhenium 0.1.1 does not support background
microphone capture.

## Support and information you send us

If you email support or report an issue, we receive the contact information,
message and attachments you choose to provide. We use that information to
respond and investigate the issue. Support email is handled by our email
provider; GitHub issues are public. Do not include passwords, private browsing
records or other sensitive information in an issue or diagnostic attachment.

Support correspondence remains in the support mailbox until deleted. You can
request deletion of correspondence held by the project by emailing
**rhenium-support@proton.me**. Public GitHub content is also subject to GitHub's
controls and retention policies. The project cannot delete information held by
websites you visit; contact those services directly.

## Children

Rhenium is a general web browser intended for users aged 13 and above. It is not
directed to children under 13 and does not provide a curated or child-safe web.

## Changes and contact

We will update this policy when Rhenium's data practices change and revise the
effective date above. The current policy is available from the
[Rhenium repository](https://github.com/smolcars/rhenium/blob/master/docs/privacy-policy.md).
Contact **rhenium-support@proton.me** with privacy questions or requests.
