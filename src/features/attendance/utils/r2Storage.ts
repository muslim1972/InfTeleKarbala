export const uploadSnapshotToR2 = async (base64Data: string, prefix: string = 'snapshot'): Promise<string | null> => {
  try {
    const response = await fetch('https://itpc-hr.vercel.app/api/upload-snapshot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64Data, prefix }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server upload error:', errorData);
      return null;
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Error uploading snapshot via API:', error);
    return null;
  }
};
