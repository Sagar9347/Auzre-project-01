require("dotenv").config();

const express = require("express");
const multer = require("multer");
const {
  BlobServiceClient
} = require("@azure/storage-blob");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 3000;

const connectionString =
  process.env.AZURE_STORAGE_CONNECTION_STRING;

const containerName =
  process.env.AZURE_STORAGE_CONTAINER_NAME;

const blobServiceClient =
  BlobServiceClient.fromConnectionString(connectionString);

const containerClient =
  blobServiceClient.getContainerClient(containerName);

app.use(express.urlencoded({ extended: true }));

// Home Page
app.get("/", async (req, res) => {
  try {
    let fileList = [];

    for await (const blob of containerClient.listBlobsFlat()) {
      fileList.push(blob.name);
    }

    const fileItems = fileList
      .map(
        file => `
        <li>
          <a href="/files/${file}" target="_blank">${file}</a>
        </li>
      `
      )
      .join("");

    res.send(`
      <h1>Azure Secure Upload App</h1>

      <form action="/upload" method="POST" enctype="multipart/form-data">
        <input type="file" name="file" required />
        <button type="submit">Upload</button>
      </form>

      <h2>Uploaded Files</h2>
      <ul>
        ${fileItems}
      </ul>
    `);

  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading files");
  }
});

// Upload Endpoint
app.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send("No file uploaded");
      }

      const blobName = req.file.originalname;

      const blockBlobClient =
        containerClient.getBlockBlobClient(blobName);

      await blockBlobClient.uploadData(req.file.buffer);

      console.log(`Uploaded: ${blobName}`);

      res.redirect("/");

    } catch (error) {
      console.error(error);
      res.status(500).send("Upload failed");
    }
  }
);

// View/Download File
app.get("/files/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;

    const blobClient =
      containerClient.getBlobClient(filename);

    const downloadBlockBlobResponse =
      await blobClient.download();

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${filename}"`
    );

    downloadBlockBlobResponse.readableStreamBody.pipe(res);

  } catch (error) {
    console.error(error);
    res.status(404).send("File not found");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});