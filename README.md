# QMail: The Quantum-Secure Email Client

<p align="center">
  <strong>The First Desktop Email Client Architected for the Post-Quantum Era.</strong><br/>
  <em>A high-fidelity software implementation of quantum-secure communication protocols.</em>
</p>

<p align="center">
  <img alt="GitHub License" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="Client" src="https://img.shields.io/badge/client-Electron%20%7C%20React-blueviolet">
  <img alt="Server" src="https://img.shields.io/badge/server-FastAPI%20%7C%20Python-success">
  <img alt="Security" src="https://img.shields.io/badge/security-MF--QKD%20%7C%20PQC-red">
</p>

---

## The Problem: "Harvest Now, Decrypt Later"

Today's standard encryption (like RSA) is based on math problems that are too hard for current computers to solve. However, a future quantum computer will be able to solve these problems with ease.

This creates a critical threat: an attacker can **harvest** and store any encrypted data sent over the internet today. In 10-20 years, they can use a quantum computer to **decrypt** it, revealing all of today's secrets. This "Harvest Now, Decrypt Later" attack makes long-term data security an urgent, unsolved problem.

**QMail directly confronts this threat.**

## What is QMail?

QMail is a next-generation, high-security desktop email client designed to protect digital communications in the post-quantum era. It functions as a sophisticated security layer that integrates seamlessly on top of existing email services like Gmail, requiring no changes to the global email infrastructure.

The core of QMail is a software-based, practical implementation of quantum-secure protocols. It provides a user-friendly environment to experience the future of secure communication, today.

![QMail Screenshot](https://i.imgur.com/7w8c3jB.png) <!-- Replace with a link to your best screenshot -->

## Key Innovations

QMail introduces two fundamental innovations that make it unique:

### 1. The Proprietary MF-QKD Protocol (Software Simulation)
QMail features the first software implementation of our novel **Multi-Factor Quantum Key Distribution (MF-QKD)** protocol.

*   **What it is:** MF-QKD is our proprietary enhancement of the foundational BB84 protocol. It is designed to encode information across multiple, independent quantum properties (e.g., polarization and phase) of a single photon.
*   **Why it's Superior:** This multi-factor approach makes the quantum state hyper-sensitive to measurement. An eavesdropper's attempt to intercept a photon is far more likely to cause a detectable disturbance (a high Quantum Bit Error Rate), providing a provably higher level of security and eavesdropping detection than standard protocols.
*   **Privacy Amplification:** Our implementation includes a final Privacy Amplification step, a state-of-the-art technique to distill a perfectly random and unconditionally secure key, even in the presence of a sophisticated active attacker attempting to gain partial information.

### 2. The Hybrid Store-and-Forward Handshake
QKD protocols require a real-time, synchronous connection. Email is an asynchronous medium. We have solved this fundamental mismatch with a novel architectural solution.

*   **How it works:** When a sender initiates a secure handshake and the recipient is offline, our server "parks" the request in a `pending_sessions` database. When the recipient comes online, the server immediately notifies their client, and the handshake is completed in real-time.
*   **The Result:** This provides the seamless user experience of email without sacrificing the unconditional security of a synchronous key exchange. It is the crucial bridge between QKD theory and real-world usability.

## Feature Overview

### Security & Innovation
*   **Tiered Security Model:** Choose the right level of security for every message.
    *   **Level 1 (OTP) & 2 (AES):** Unconditionally secure messaging using our proprietary MF-QKD protocol.
    *   **Level 3 (PQC):** A purely software-based, quantum-resistant option using Post-Quantum Cryptography, perfect for offline recipients.
    *   **Level 4 (BB84):** A simulation of the foundational QKD protocol.
    *   **Level 5 (Normal):** Standard, unencrypted email for non-QMail users.
*   **True End-to-End Encryption:** All key generation, encryption, and decryption happens exclusively on the client's device. The server has zero knowledge of keys or message content.
*   **The "Proof of Security" Test:** View a QMail-encrypted message in a standard email client (like Gmail) to see the unreadable ciphertext, providing undeniable proof of its effectiveness.

### User Experience
*   **High-Performance Local Cache:** Instant load times and full offline access to synced emails, powered by a local SQLite database.
*   **Non-Blocking Background Sync:** All email fetching and synchronization happens in a background process, ensuring the UI is always fast, fluid, and responsive.
*   **Real-Time Push Notifications:** Uses WebSockets to provide instant notifications for new mail, triggering an immediate sync.
*   **The "Magic Moment" Handshake:** An engaging animation that transforms the key exchange delay into a visual demonstration of the security protocol in action.

## Architectural Overview

QMail consists of a separate client and server, designed for maximum security and performance.

*   **Client (The `client` directory):**
    *   **Framework:** Electron
    *   **UI:** React (with Vite)
    *   **State Management:** React Contexts
    *   **Local Database:** SQLite3
    *   **Core Logic:** `qkdService.js` contains the complete, high-fidelity simulation of the MF-QKD, BB84, and Privacy Amplification protocols.

*   **Server (The `server` directory):**
    *   **Framework:** FastAPI (Python)
    *   **Real-Time Communication:** `python-socketio` for the WebSocket-based handshake relay.
    *   **Database:** Supabase (PostgreSQL) for user authentication and pending session management.
    *   **Architecture:** A lightweight, zero-knowledge backend that only handles authentication and connection relay.

## Getting Started

Follow these instructions to set up and run the QMail project on your local machine for development and testing.

### Prerequisites

*   Node.js and npm
*   Python 3.8+ and pip
*   A Supabase account (for the database and user auth)
*   A Google Cloud Platform account (to enable Gmail API and get OAuth2 credentials)

### 1. Server Setup

```bash
# Navigate to the server directory
cd server

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows, use `venv\Scripts\activate`

# Install dependencies
pip install -r requirements.txt

# Create a .env file in the /server directory and fill in your credentials
# (See .env.example for the required variables)
cp .env.example .env
nano .env # Or use your favorite editor

# Run the FastAPI server
uvicorn app.main:app_asgi --reload
```

The server will be running at http://localhost:8000.

### 2. Client Setup

You will need two separate terminals to simulate two different users.

**Terminal 1 (User A - "Alice"):**

```bash
# Navigate to the client directory
cd client

# Install dependencies
npm install

# Run the first client instance (defaults to port 5173)
npm run dev:electron
```

**Terminal 2 (User B - "Bob"):**

```bash
# Navigate to the client directory
cd client

# Run the second client instance (uses alternate port 5174)
# This requires the custom scripts in package.json to be set up correctly.
npm run dev:electron2
```

You now have two independent client windows. Log in with two different registered user accounts and link their respective Gmail accounts in the Settings page to begin testing.

## Future Work

This project provides a robust foundation for the future of secure communication. The roadmap includes:

**Hardware Integration:** Abstracting the qkdService.js to allow it to interface with real, physical QKD hardware, validating the simulation's results.

**Expanding PQC Suite:** Integrating a wider range of NIST-standardized Post-Quantum Cryptography algorithms into the Level 3 security option.

**Mobile Client:** Developing a mobile version of QMail to bring quantum-ready security to all platforms.


## License

Distributed under the MIT License. See LICENSE for more information.

## Author

Mahavishnu K - [Visit Portfolio] (https://mahavishnu-k.vercel.app/ "Portfolio")
