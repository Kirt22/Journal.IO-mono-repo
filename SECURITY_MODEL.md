# Security Model

journal.io uses **Model A security architecture**.

This allows AI analysis while maintaining strong encryption.

---

# Encryption In Transit

All network communication uses:

HTTPS
TLS 1.3

This protects data between device and server.

---

# Encryption At Rest

All sensitive data is encrypted at rest.

Database encryption uses:

AES-256

MongoDB encryption features may be used where available.

---

# Why End-To-End Encryption Is Not Used In MVP

True end-to-end encryption prevents the server from reading journal content.

AI insights require access to journal text.

Therefore:

E2EE cannot be used in the MVP version.

---

# Future Optional E2EE Mode

Future versions may support optional E2EE.

In this mode:

journals encrypted on device
server stores encrypted data
AI insights disabled

Users may choose between:

AI insights mode
private E2EE mode

---

# Privacy Controls

Users can control their data.

Features include:

data export
account deletion
AI analysis opt-out

---

# Privacy APIs

POST /privacy/export
POST /privacy/delete-request

These allow users to control their stored data.

---

# Trust Principles

User data must always be:

private
secure
transparent
user-controlled
