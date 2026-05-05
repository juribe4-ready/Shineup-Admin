const AIRTABLE_BASE = 'appBwnoxgyIXILe6M';
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, recordId, status, closeComment } = req.body;

    if (!type || !recordId || !status) {
      return res.status(400).json({ error: 'Missing required fields: type, recordId, status' });
    }

    // Determine table based on type
    let tableId;
    if (type === 'incident') {
      tableId = 'Incidents'; // Table name
    } else if (type === 'inventory') {
      tableId = 'tblppdLDDnyT0eye9'; // ClientInventory table ID
    } else {
      return res.status(400).json({ error: 'Invalid type. Must be "incident" or "inventory"' });
    }

    // Build fields to update
    const fields = { Status: status };
    
    // Add CloseComment if provided and status is closed/optimal
    if (closeComment && (status === 'Closed' || status === 'Optimal')) {
      fields.CloseComment = closeComment;
    }

    console.log(`[updateReport] type=${type}, recordId=${recordId}, status=${status}, closeComment=${closeComment ? 'yes' : 'no'}`);

    // Update the record in Airtable
    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}/${recordId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[updateReport] Airtable error:', errorData);
      return res.status(response.status).json({ error: errorData.error?.message || 'Failed to update record' });
    }

    const updatedRecord = await response.json();
    
    return res.status(200).json({
      success: true,
      record: {
        id: updatedRecord.id,
        status: updatedRecord.fields.Status,
        closeComment: updatedRecord.fields.CloseComment || null,
      },
    });

  } catch (err) {
    console.error('[updateReport] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
