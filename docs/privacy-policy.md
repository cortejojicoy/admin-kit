<!--
  MAINTAINER NOTE — not published (HTML comments are stripped at build time).

  Prepared against the Data Privacy Act of 2012 (RA 10173), its Implementing
  Rules and Regulations, and NPC Circular 16-03 on breach notification. It has
  NOT been reviewed by a lawyer. Have counsel review it before relying on it.

  The controller is named as the Project rather than a registered company,
  which is accurate today. If a legal entity is later incorporated, replace
  section 1 and section 13 with its registered name, address and DPO — and note
  that NPC registration thresholds may then apply.

  Contact runs through the repository's issue tracker and private security
  advisories, so no personal email address is published. If a dedicated privacy
  mailbox is ever set up, add it to section 1.

  Keep this file honest: if the site gains analytics, a contact form or a
  third-party embed, this page changes in the same commit.
-->

# Privacy Policy

**Last updated: 11 September 2026**

This Privacy Policy explains how the admin-kit project ("the Project", "we",
"us", "our") handles personal data in connection with the
`@cortejojicoy/admin-kit` documentation website and the Axiomkit live demo
(together, "the Services").

It is issued in compliance with the **Data Privacy Act of 2012 (Republic Act No.
10173)** of the Republic of the Philippines, its Implementing Rules and
Regulations, and the issuances of the National Privacy Commission ("NPC").

In summary: the Services are documentation for an open-source software library.
We operate no user accounts, no analytics, no advertising and no tracking of any
kind. We collect very little personal data, and we neither sell nor share it for
marketing.

## 1. Personal Information Controller

For the purposes of the Act, the Personal Information Controller is:

| | |
| --- | --- |
| Controller | The admin-kit project, an open-source software project |
| Privacy contact | https://github.com/cortejojicoy/admin-kit/issues |
| Confidential contact | A private security advisory on the same repository |

Requests and complaints concerning personal data may be submitted through either
channel. Matters you would prefer not to raise in public should be sent through
the confidential channel, which is visible only to the Project's maintainers.

The Project does not presently operate as a registered corporate entity. Should
that change, this section will be amended to name the entity, its registered
address and its Data Protection Officer.

## 2. Scope of this Policy

This Policy applies to:

- the **documentation website**, and
- the **Axiomkit live demo** application, where one is published.

It does **not** apply to the `@cortejojicoy/admin-kit` software package itself.
Where you install the package and operate it on your own infrastructure, you —
not the Project — are the Personal Information Controller for all personal data
your application processes. The package contains no telemetry, no analytics and
no reporting behaviour of any kind: it transmits nothing to us, and we have no
visibility into your data or your users'.

This Policy likewise does not apply to third-party websites linked from the
Services, such as GitHub or npm, each of which publishes its own privacy policy.

## 3. Personal data we process

### 3.1 The documentation website

| Data | Purpose | Location |
| --- | --- | --- |
| Your light/dark theme preference | To present the site as you last chose to read it | `localStorage` within your own browser, under the key `ak-theme` |
| Server access logs — IP address, browser user-agent, page requested, timestamp | Generated automatically by our hosting provider to deliver the site and protect it from abuse | Held by the hosting provider (section 6) |

Your theme preference **never leaves your browser**. It is not transmitted to us
or to any third party, and we are unable to read it. You may erase it at any
time by clearing site data for this domain.

The website sets **no cookies**, operates **no analytics**, embeds **no
advertising or social-media trackers**, and loads **no third-party scripts or
fonts**. There are no accounts, no registration, no mailing list and no contact
form. The only network request the website makes is for its own search index,
served from the same domain.

We list server access logs here because an IP address may constitute personal
information under the Act, notwithstanding that we do not inspect these logs in
the ordinary course.

### 3.2 The Axiomkit live demo

The demo is a deliberately fictitious application. It is seeded with invented
accounts (`ada@axiomkit.test` and similar) and a published password, `demo`.

| Data | Purpose | Retention |
| --- | --- | --- |
| A session cookie named `axiomkit_session` | To maintain your signed-in session within the demo | 8 hours, after which it expires |
| Credentials entered into the demo's sign-in form | Compared against the fictitious accounts to authenticate the session | Not stored; discarded once the request is served |
| Changes you make within the demo, such as editing or deleting a fictitious record | So that the demo behaves as a working application | Held in server memory only, and erased on restart |

The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production. It
carries only a signed token identifying which **fictitious** account was
selected. It is not an advertising or tracking cookie and is disclosed to no
one.

**Users are asked not to enter real personal data into the demo.** It is a
public sandbox and should be used with the fictitious accounts provided.

## 4. Purposes and lawful basis

| Purpose | Lawful basis under RA 10173 |
| --- | --- |
| Delivering the Services and maintaining their availability and security | Legitimate interests (Sec. 12(f)) — access logs are the ordinary means of operating a website and defending it against abuse, and the interest does not override your fundamental rights |
| Retaining your theme preference | Consent (Sec. 12(a)), given by selecting a theme; the value is stored solely on your own device |
| Operating the demo session | Legitimate interests (Sec. 12(f)) — a demonstration of authenticated access cannot function without a session |

We do not process **sensitive personal information** as defined in Sec. 3(l) of
the Act — including data concerning health, race, ethnic origin, religious or
political affiliation, marital status, government-issued identifiers, or any
proceeding for an offence. Such data is neither requested nor wanted, and users
are asked not to submit it.

We carry out no automated decision-making or profiling, and we use no personal
data for direct marketing.

## 5. Retention

| Data | Retention period |
| --- | --- |
| Theme preference | Until you clear your browser storage; we never hold a copy |
| Hosting access logs | The rolling period determined by the hosting provider |
| Demo session cookie | 8 hours from sign-in, or until cleared by you |
| Data entered into the demo | Until the demo server restarts |

We maintain no archives or analytical backups of personal data, and we retain
nothing beyond the purposes described in section 4. Personal data is disposed of
in a manner that prevents further processing, unauthorised access, or disclosure
to any other party.

## 6. Disclosure and third parties

The Services operate on third-party infrastructure. These providers act as
Personal Information Processors under the Act and receive only what is
technically necessary to deliver the Services:

| Provider | Role |
| --- | --- |
| GitHub, Inc. (GitHub Pages) | Hosts the documentation website and its access logs |
| The demo's hosting provider | Hosts the live demo, where one is published |

We **do not sell, rent, or trade personal data**, and we disclose none of it for
advertising purposes.

Personal data may be disclosed where disclosure is required by Philippine law,
by an order of a court, or by a competent public authority acting within its
mandate.

### 6.1 Cross-border transfers

These providers operate infrastructure outside the Philippines, and access logs
may accordingly be processed abroad. In accordance with Sec. 21 of the Act, the
Project remains accountable for personal data transferred to a third party,
including transfers across borders, and relies on these providers' contractual
undertakings and security commitments in respect of such processing.

## 7. Security measures

Consistent with Sec. 20 of the Act, we maintain organisational, physical and
technical measures that are reasonable and appropriate to the limited volume and
sensitivity of the data involved:

- the Services are served **exclusively over HTTPS**;
- the documentation website is **static** — it operates no database, no user
  accounts and no administrative interface capable of being compromised;
- the demo's session cookie is `HttpOnly`, placing it beyond the reach of
  scripts running in the browser, and `Secure` in production;
- the demo retains nothing durable — its data resides in memory and is erased on
  restart;
- access to publishing and deployment infrastructure is **restricted to
  authorised Project maintainers** and protected by multi-factor authentication;
- all changes to the Services are made through a public version-controlled
  repository, so any change affecting personal data is auditable.

No method of transmission or storage is entirely secure, and we are unable to
warrant absolute security.

## 8. Rights of data subjects

Under Chapter IV of the Act, you have the right to:

- **be informed** whether personal data pertaining to you is being processed, and
  to be furnished the information set out in this Policy before such data is
  collected;
- **object** to the processing, including withdrawing consent previously given;
- **access** the personal data we hold concerning you, together with the
  purposes, recipients and manner of processing;
- **rectify** any inaccurate or erroneous personal data;
- **suspend, withdraw, block or erase** personal data that is incomplete,
  outdated, false, unlawfully obtained, used for an unauthorised purpose, or no
  longer necessary for the purposes for which it was collected;
- **data portability** — to obtain a copy of personal data you provided, in an
  electronic, structured and commonly used format (Sec. 18);
- **be indemnified** for damages sustained by reason of inaccurate, incomplete,
  outdated, false, unlawfully obtained or unauthorised use of personal data; and
- **lodge a complaint** with the National Privacy Commission.

Requests may be made through either channel in section 1. We will respond within
a reasonable period and may ask for information sufficient to locate the data
concerned. No fee is charged.

In practice there is generally little to act upon: your theme preference resides
on your own device and may be deleted by you at any time, and the demo session
ends when the cookie is cleared or the server restarts.

## 9. Complaints

If you believe your rights under the Act have been infringed, you may raise the
matter with us through either channel in section 1. You may in any event lodge a
complaint with:

> **National Privacy Commission**
> 5th Floor, Delegation Building, PICC Complex,
> Roxas Boulevard, Pasay City, Metro Manila 1307
> complaints@privacy.gov.ph · info@privacy.gov.ph
> https://www.privacy.gov.ph

## 10. Personal data breaches

Where a personal data breach occurs that meets the notification criteria of the
Act and NPC Circular 16-03, we will notify the National Privacy Commission and
the affected data subjects within **72 hours** of knowledge of, or reasonable
belief in, the occurrence of the breach.

## 11. Children

The Services are documentation intended for software developers and are not
directed at children. We do not knowingly collect personal data from any person
under 18 years of age. If you believe a child has provided personal data, please
contact us and it will be deleted.

## 12. Amendments

We may amend this Policy from time to time. Any amendment takes effect upon
publication on this page, with a revised "last updated" date. The complete
revision history of this document is public in the repository, so every change
may be compared line by line.

## 13. Contact

Enquiries concerning this Policy, or concerning our handling of personal data,
may be directed to the Project through either channel set out in section 1.
