const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS & JSON parsing
app.use(cors());
app.use(express.json());

// In-Memory Data Store for MVP
let contacts = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    relation: 'Family',
    phone: '+1 (555) 234-5678',
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Dr. Robert Miller',
    relation: 'Neighbor',
    phone: '+1 (555) 876-5432',
    createdAt: new Date().toISOString()
  },
  {
    id: '3',
    name: 'Alex Rivera',
    relation: 'Friend',
    phone: '+1 (555) 345-6789',
    createdAt: new Date().toISOString()
  }
];

let activeEmergency = null;
let emergencyHistory = [];

/* =========================================================================
   REAL-WORLD TWILIO INTEGRATION GUIDE (COMMENTED FOR PRODUCTION USE)
   To enable real SMS & Phone calls via Twilio:
   1. Run: npm install twilio
   2. Set environment variables in .env:
      TWILIO_ACCOUNT_SID=your_account_sid
      TWILIO_AUTH_TOKEN=your_auth_token
      TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
   3. Uncomment the twilio client initialization and trigger functions below.
========================================================================= */

/*
const twilio = require('twilio');
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Send Twilio SMS to emergency contact
async function sendTwilioSMS(toPhone, messageBody) {
  if (!twilioClient) {
    console.warn('[Twilio] Twilio client not configured. Skipping real SMS.');
    return;
  }
  try {
    const message = await twilioClient.messages.create({
      body: messageBody,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: toPhone
    });
    console.log(`[Twilio SMS] Sent to ${toPhone}, SID: ${message.sid}`);
    return message;
  } catch (err) {
    console.error(`[Twilio SMS Error] Failed to send to ${toPhone}:`, err.message);
  }
}

// Initiate automated Voice Call via Twilio
async function triggerTwilioEmergencyCall(toPhone, personName, liveAddress, mapUrl) {
  if (!twilioClient) {
    console.warn('[Twilio] Twilio client not configured. Skipping real voice call.');
    return;
  }
  try {
    const twimlMessage = `
      <Response>
        <Say voice="alice" language="en-US">
          Urgent alert from LifeTap! ${personName} is experiencing an emergency right now.
          Location: ${liveAddress}.
          A text message with the direct Google Maps link has also been sent to your phone.
          Please check your phone immediately and provide assistance!
        </Say>
      </Response>
    `;
    const call = await twilioClient.calls.create({
      twiml: twimlMessage,
      to: toPhone,
      from: process.env.TWILIO_PHONE_NUMBER
    });
    console.log(`[Twilio Voice Call] Initiated call to ${toPhone}, SID: ${call.sid}`);
    return call;
  } catch (err) {
    console.error(`[Twilio Call Error] Failed to call ${toPhone}:`, err.message);
  }
}
*/

// ==========================================
// ROUTES: Contacts Management (/api/contacts)
// ==========================================

// GET all contacts
app.get('/api/contacts', (req, res) => {
  return res.json({
    success: true,
    data: contacts
  });
});

// POST add new contact
app.post('/api/contacts', (req, res) => {
  const { name, relation, phone } = req.body;

  if (!name || !relation || !phone) {
    return res.status(400).json({
      success: false,
      message: 'Name, relation, and phone number are required.'
    });
  }

  const newContact = {
    id: Date.now().toString(),
    name: name.trim(),
    relation: relation.trim(),
    phone: phone.trim(),
    createdAt: new Date().toISOString()
  };

  contacts.push(newContact);

  console.log(`[LifeTap] Added contact: ${newContact.name} (${newContact.relation}) - ${newContact.phone}`);

  return res.status(201).json({
    success: true,
    message: 'Emergency contact added successfully',
    data: newContact
  });
});

// DELETE contact by id
app.delete('/api/contacts/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = contacts.length;
  contacts = contacts.filter(c => c.id !== id);

  if (contacts.length === initialLength) {
    return res.status(404).json({
      success: false,
      message: 'Contact not found'
    });
  }

  return res.json({
    success: true,
    message: 'Contact deleted successfully'
  });
});

// ==========================================
// ROUTES: Emergency System (/api/emergency)
// ==========================================

// POST trigger emergency alert
app.post('/api/emergency', (req, res) => {
  const { name, address, lat, lng, phone, contactsList } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'Person name is required to trigger emergency.'
    });
  }

  const latitude = lat || 0;
  const longitude = lng || 0;
  const mapUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
  const resolvedAddress = address || `Lat: ${latitude}, Lng: ${longitude}`;
  const alertMessage = `${name} got emergency at ${resolvedAddress} - ${mapUrl}`;

  const emergencyEvent = {
    id: 'emg_' + Date.now(),
    name,
    phone: phone || 'Unknown',
    address: resolvedAddress,
    lat: latitude,
    lng: longitude,
    mapUrl,
    message: alertMessage,
    status: 'ACTIVE', // 'ACTIVE', 'RESPONDED', 'CANCELLED'
    createdAt: new Date().toISOString(),
    helper: null,
    contactsNotified: (contactsList && contactsList.length > 0) ? contactsList : contacts
  };

  activeEmergency = emergencyEvent;
  emergencyHistory.unshift(emergencyEvent);

  console.log('----------------------------------------------------');
  console.log('[🚨 LIFETAP EMERGENCY TRIGGERED 🚨]');
  console.log(`Victim: ${name}`);
  console.log(`Location: ${resolvedAddress}`);
  console.log(`Google Maps: ${mapUrl}`);
  console.log(`Notifying ${emergencyEvent.contactsNotified.length} contacts:`);
  emergencyEvent.contactsNotified.forEach(c => {
    console.log(` -> Alert dispatched to [${c.relation}] ${c.name} (${c.phone})`);
  });
  console.log('----------------------------------------------------');

  /*
  // In production with Twilio:
  emergencyEvent.contactsNotified.forEach(async (c) => {
    await sendTwilioSMS(c.phone, alertMessage);
    // If no response after 30s:
    // setTimeout(() => triggerTwilioEmergencyCall(c.phone, name, resolvedAddress, mapUrl), 30000);
  });
  */

  return res.status(201).json({
    success: true,
    message: 'Emergency broadcast triggered successfully.',
    data: emergencyEvent
  });
});

// GET active emergency
app.get('/api/emergency/latest', (req, res) => {
  return res.json({
    success: true,
    data: activeEmergency
  });
});

// POST respond to emergency ("Yes, I'm Going" or "No, I am not able to help")
app.post('/api/emergency/respond', (req, res) => {
  const { emergencyId, helperName, response } = req.body;

  if (!helperName || !response) {
    return res.status(400).json({
      success: false,
      message: 'helperName and response (yes/no) are required.'
    });
  }

  if (!activeEmergency) {
    // If no active memory emergency, create an ad-hoc confirmation
    return res.json({
      success: true,
      broadcastMessage: `${helperName} is going to help`,
      response
    });
  }

  if (response.toLowerCase() === 'yes') {
    activeEmergency.status = 'RESPONDED';
    activeEmergency.helper = helperName;
    const broadcastMessage = `${helperName} is going to help ${activeEmergency.name}`;

    console.log('----------------------------------------------------');
    console.log(`[✅ LIFETAP HERO RESPONSE] ${broadcastMessage}`);
    console.log('Countdown stopped. Hospital navigation activated.');
    console.log('----------------------------------------------------');

    return res.json({
      success: true,
      broadcastMessage,
      emergency: activeEmergency
    });
  } else {
    console.log(`[⚠️ LIFETAP RESPONSE] ${helperName} cannot help at this moment.`);
    return res.json({
      success: true,
      message: `${helperName} indicated unable to help. Alert remains active for other responders.`,
      emergency: activeEmergency
    });
  }
});

// POST cancel emergency
app.post('/api/emergency/cancel', (req, res) => {
  if (activeEmergency) {
    activeEmergency.status = 'CANCELLED';
    console.log(`[LifeTap] Emergency ${activeEmergency.id} cancelled.`);
  }
  activeEmergency = null;
  return res.json({
    success: true,
    message: 'Emergency cancelled successfully.'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'LifeTap SOS Backend',
    timestamp: new Date().toISOString()
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` LifeTap SOS Backend Server Running on port ${PORT}`);
  console.log(` API Endpoints:`);
  console.log(`   - GET/POST/DELETE /api/contacts`);
  console.log(`   - POST            /api/emergency`);
  console.log(`   - GET             /api/emergency/latest`);
  console.log(`   - POST            /api/emergency/respond`);
  console.log(`   - GET             /api/health`);
  console.log(`===============================================`);
});
