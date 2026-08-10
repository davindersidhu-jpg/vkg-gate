// Local / Windows-server entrypoint. Not used on Netlify — see
// netlify/functions/api.js for the serverless entrypoint.
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`VKG Gate Management running on http://localhost:${PORT}`);
});
