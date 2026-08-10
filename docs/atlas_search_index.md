# MongoDB Atlas Vector Search Configuration

To support semantic search using the `gemini-embedding-2` model, you must create a Vector Search Index in your MongoDB Atlas cluster.

**Important**: Do not create this as a standard database index. It must be created via the "Atlas Search" tab in the MongoDB Atlas UI.

### Instructions

1. Go to your MongoDB Atlas cluster.
2. Select **Atlas Search** and click **Create Search Index**.
3. Select **JSON Editor**.
4. Select the Database: `docask` and the Collection: `documentchunks`.
5. Name the index `vector_index` (or similar).
6. Paste the following JSON configuration:

```json
{
  "fields": [
    {
      "numDimensions": 3072,
      "path": "embedding",
      "similarity": "cosine",
      "type": "vector"
    },
    {
      "path": "userId",
      "type": "filter"
    },
    {
      "path": "documentId",
      "type": "filter"
    }
  ]
}
```

7. Click **Next** and then **Create Search Index**.
8. Wait for the index status to become `Active`.

*Note: The `numDimensions` is set to `3072` which is the default dimension size for `gemini-embedding-2`. If you choose to truncate the dimensions via the API later, you MUST update this index configuration to match the exact truncated dimensionality.*
