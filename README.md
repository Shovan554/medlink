# 🩺 MedLink – Remote Care with Real-Time Health Insights

MedLink is a telehealth platform that connects patients and doctors through **real-time health data, secure messaging, and remote monitoring**. Instead of relying on a single snapshot of vitals during a clinic visit, MedLink provides doctors with continuous trends from wearables like Apple Health, helping improve diagnosis and reduce unnecessary hospital visits.

---

## 🚀 Why MedLink?
- Patients often travel long distances or wait hours for minor checkups.  
- Doctors only get limited snapshots of patient vitals, which can lead to incomplete diagnoses.  
- Healthcare is expensive and often inaccessible in rural or underserved areas.  

MedLink solves this by **bringing continuous health monitoring and doctor-patient communication into one platform**.

---

## ✨ Key Features
- **Real-Time Health Data**: Track heart rate, respiratory rate, SpO₂, HRV, and wrist temperature.  
- **Doctor Dashboard**: View patient trends (steps, calories, sleep, daylight exposure).  
- **Patient Portal**: Easy access to vitals, appointments, and chat with doctors.  
- **Secure Messaging**: Encrypted doctor–patient communication.  
- **Alerts & Notifications**: Detect anomalies and notify patients/doctors.  
- **Remote Care**: Reduce unnecessary clinic visits and enable continuous follow-up.  

---

## 🛠️ Tech Stack

### Backend
- Runtime: **Node.js** with ES modules  
- Framework: **Express.js (v4.18.2)**  
- Database: **PostgreSQL** with pg driver (v8.16.3)  
- Authentication: **JWT** (jsonwebtoken v9.0.2) + **bcrypt** (v6.0.0)  
- Config: **dotenv** for environment management  
- HTTP Client: **Axios**  
- **CORS** enabled  

### Frontend
- Framework: **React (v19.1.1)** with React DOM (v19.1.1)  
- Build Tool: **Vite (v7.1.2)**  
- Routing: **React Router DOM (v7.8.2)**  
- Charts: **Recharts (v3.1.2)**  
- Animations: **Lottie React (v2.4.1)**  
- Linting: **ESLint** with React plugins  
- TypeScript: Type definitions included  

### Database (PostgreSQL)
- **users** – Accounts (roles: patient/doctor)  
- **patients**, **doctors** – Profiles and details  
- **health_realtime** – Real-time metrics (heart rate, respiratory rate, step count, active energy)  
- **health_aggregated** – Aggregated metrics (SpO₂, HRV, wrist temp, sleep, daylight, etc.)  
- **messages** – Doctor-patient communication  
- **appointments** – Scheduling and availability  
- **alerts** – Health alerts and notifications  

---

## 🔄 Data Flow: Apple Watch → MedLink
1. **Apple Watch** collects health metrics (heart rate, SpO₂, HRV, wrist temp, steps, calories, etc.).  
2. **Apple Health API / Health Auto Export** extracts data to the user’s device.  
3. **MedLink Backend (Node.js/Express)** receives the data via secure API requests.  
4. **PostgreSQL Database** stores data in `health_realtime` (immediate values) and `health_aggregated` (trends, summaries).  
5. **Doctor’s Dashboard (React + Recharts)** visualizes the data, highlighting spikes or anomalies.  
6. **Patient Portal** allows patients to see their metrics, while **alerts** notify doctors of concerning changes.  

---

## 📊 Example Use Case
- A patient reports chest discomfort.  
- Doctor checks MedLink dashboard → sees stable heart rate but a spike in respiratory rate.  
- Doctor reassures it’s not cardiac but likely reflux + shortness of breath.  
- Patient avoids unnecessary ER visit, and doctor sets reminders to monitor trends.  

---

## ⚙️ Development Setup
```bash
# clone the repo
git clone https://github.com/Shovan554/medlink.git
cd medlink

# backend setup
cd backend
npm install
npm run dev   # runs on http://localhost:3001

# frontend setup
cd ../frontend
npm install
npm run dev   # runs on http://localhost:3000

Ensure PostgreSQL is running on localhost:5432 and update .env in backend/config with DB credentials.

🤝 Contributing

Fork the repo

Create a feature branch (git checkout -b feature/new-feature)

Commit changes (git commit -m "Add new feature")

Push (git push origin feature/new-feature)

Open a Pull Request

📜 License

MIT License – free to use, modify, and share.


---

👉 Do you want me to also design a **simple diagram (ASCII or mermaid)** of this data flow so the README has a visual pipeline (Watch → API → Server → DB → Dashboard)?
