/**
 * External API Service
 * 
 * Handles calling the external API configured in .env
 * All API URL, auth token, AccountId, UserId logic lives here — NOT in frontend.
 * 
 * To change the external API target, edit these in server/.env:
 *   EXTERNAL_API_URL
 *   EXTERNAL_API_AUTH_TOKEN
 *   EXTERNAL_API_ACCOUNT_ID
 *   EXTERNAL_API_USER_ID
 */


const fetchExternalData = async () => {
  const url = 'https://pgapi.plumb5.in/cmo/GetTotalLeadsCount';
  const authToken = process.env.EXTERNAL_API_AUTH_TOKEN;
  const accountId = parseInt(process.env.EXTERNAL_API_ACCOUNT_ID) || 0;
  const userId = parseInt(process.env.EXTERNAL_API_USER_ID) || 0;

  if (!url || url === 'https://pgapi.plumb5.in/cmo/GetTotalLeadsCount') {
    throw new Error(
      'aaaaaaaaaaa.'
    );
  }

  const headers = {
    'Content-Type': 'application/json',
    'P5APIKEY':'056d9b3cb5e4b39b5e4512b5eb331b5e6371c81031b8',
    'P5AccountId':accountId,
  };

  // if (authToken && authToken !== 'your-bearer-token-here') {
  //   headers['Authorization'] = `Bearer ${authToken}`;
  // }

  const body = JSON.stringify({
    startDate: '2000-05-20T12:57:53.766Z',
    endDate: '2026-05-20T12:57:53.766Z',
    userId:userId
  });

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });
  } catch (fetchErr) {
    const code = fetchErr?.cause?.code || fetchErr.code || '';
    if (code === 'ECONNREFUSED') {
      throw new Error(
        `Cannot connect to external API at ${url} — the service is not running or unreachable.`
      );
    }
    throw new Error(`Network error reaching external API: ${fetchErr.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `External API returned HTTP ${response.status}: ${response.statusText}. ${errorText}`.trim()
    );
  }

  const resData = await response.json();
  return resData;
};

module.exports = { fetchExternalData };
