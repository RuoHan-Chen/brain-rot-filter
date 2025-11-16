# Focus Passkey Server

Express server for sending Focus Filter passkeys via Resend email.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Resend:**
   - Create a Resend account at https://resend.com
   - Get your API key from the dashboard
   - Use `onboarding@resend.dev` for testing, or verify your own domain

3. **Configure environment variables:**
   ```bash
   cp env.template .env
   ```
   
   Then edit `.env` and add:
   - `RESEND_API_KEY` - Your Resend API key (e.g., `re_Ux7H2vzF_49Bb393jXpunCLaHf4xaYTG1`)
   - `FROM_EMAIL` - Your sender email (use `onboarding@resend.dev` for testing)
   - `PORT` - Server port (default: 3000)

4. **Run the server:**
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

## API Endpoints

### POST `/send-passkey`

Sends a passkey to the specified email address.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "AiLing",  // optional
  "passkey": "123456"
}
```

**Response:**
- `200 OK`: Email sent successfully
  ```json
  { "ok": true, "id": "email_id_from_resend" }
  ```
- `400 Bad Request`: Missing or invalid parameters
- `502 Bad Gateway`: Resend API error
- `500 Internal Server Error`: Server error

## Testing

Test the endpoint with curl:

```bash
curl -X POST http://localhost:3000/send-passkey \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","username":"AiLing","passkey":"123456"}'
```

## Deployment

Deploy to any Node.js hosting platform (Render, Railway, Fly.io, etc.):

1. Push code to GitHub
2. Create new project on hosting platform
3. Set environment variables:
   - `RESEND_API_KEY`
   - `FROM_EMAIL`
   - `PORT` (optional, defaults to 3000)
4. Set start command: `node index.js`
5. Update extension to use the deployed URL

## Security Notes

- The server currently allows CORS from any origin (`origin: '*'`)
- For production, consider:
  - Restricting CORS to your extension's origin
  - Adding rate limiting
  - Adding basic authentication or shared secret
  - Validating requests more strictly

