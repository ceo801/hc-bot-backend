const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const { DateTime } = require('luxon');

const app = express();
app.use(bodyParser.json());

// Variables de entorno
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const API_KEY = process.env.BOOKING_API_KEY || 'hc-super-key-2025';
const TZ = process.env.TZ || 'America/Mexico_City';

// Autenticación con Google
const jwtClient = new google.auth.JWT({
  email: SERVICE_EMAIL,
  key: PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

// Crear evento
async function createEvent({ title, description, start, end, location, attendees = [] }) {
  const calendar = google.calendar({ version: 'v3', auth: jwtClient });
  const event = {
    summary: title,
    description,
    start: { dateTime: start, timeZone: TZ },
    end: { dateTime: end, timeZone: TZ },
    location,
    attendees: attendees.map(e => ({ email: e })),
  };
  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    resource: event,
    sendUpdates: 'all',
  });
  return res.data;
}

app.get('/', (_, res) => res.send('✅ HC Bot Backend activo'));

app.post('/book', async (req, res) => {
  try {
    if (req.headers['x-api-key'] !== API_KEY) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, fecha, duracionMin = 45, notas = '', email } = req.body;
    if (!nombre || !telefono || !fecha) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    const start = DateTime.fromISO(fecha, { zone: TZ });
    if (!start.isValid) return res.status(400).json({ error: 'Formato de fecha inválido' });
    const end = start.plus({ minutes: duracionMin });

    const event = await createEvent({
      title: `Cita con ${nombre}`,
      description: `Cliente: ${nombre}\nTeléfono: ${telefono}\nNotas: ${notas}`,
      start: start.toISO(),
      end: end.toISO(),
      location: 'Google Meet / Llamada',
      attendees: email ? [email] : [],
    });

    return res.json({ ok: true, link: event.htmlLink });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
