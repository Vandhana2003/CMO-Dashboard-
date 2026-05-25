
const fetchExternalData = async () => {

  const response = await fetch(
    'https://pgapi.plumb5.in/cmo/GetTotalLeadsCount',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'P5APIKEY': process.env.EXTERNAL_API_AUTH_TOKEN,
        'P5AccountId': process.env.EXTERNAL_API_ACCOUNT_ID,
      },
      body: JSON.stringify({
        accountId: Number(process.env.EXTERNAL_API_ACCOUNT_ID),
        userId: Number(process.env.EXTERNAL_API_USER_ID),
        startDate: '2000-01-01T00:00:00.000Z',
        endDate: '2026-05-21T23:59:59.999Z',
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Swagger API Error: ${response.status} ${errorText}`
    );
  }

  const data = await response.json();

  return data;
};

module.exports = {
  fetchExternalData
};