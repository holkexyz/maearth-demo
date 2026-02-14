export default function Home() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{ marginBottom: '48px' }}>
          <h1 style={{
            fontSize: '42px',
            fontWeight: 300,
            letterSpacing: '-0.5px',
            margin: '0 0 12px 0',
            color: '#2d2d2d',
          }}>
            Ma Earth
          </h1>
          <p style={{
            fontSize: '17px',
            color: '#6b6b6b',
            lineHeight: 1.6,
            margin: 0,
          }}>
            Nourishing people and planet
          </p>
        </div>

        <form action="/api/oauth/login" method="GET" style={{ margin: 0 }}>
          <div style={{ marginBottom: '16px', textAlign: 'left' }}>
            <label htmlFor="email" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: '#4a4a4a',
              marginBottom: '6px',
            }}>
              Email address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              autoFocus
              placeholder="you@example.com"
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: '16px',
                border: '1px solid #d4d0cb',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#fff',
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              display: 'block',
              width: '100%',
              padding: '14px 28px',
              fontSize: '16px',
              fontWeight: 500,
              color: '#faf9f6',
              background: '#4a6741',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              letterSpacing: '0.3px',
            }}
          >
            Sign in
          </button>
        </form>

        <p style={{
          marginTop: '32px',
          fontSize: '13px',
          color: '#999',
          lineHeight: 1.5,
        }}>
          Sign in with your Certified identity.
          <br />
          Powered by the AT Protocol.
        </p>
      </div>
    </div>
  )
}
