const express = require('express');
const youtubedl = require('youtube-dl-exec');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = 8080;

app.use(express.json());

const downloadsDir = path.join(__dirname, 'downloads');
fs.ensureDirSync(downloadsDir);

app.post('/download/:quality', async (req, res) => {
  try {
    const { url } = req.body;
    const quality = req.params.quality;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!url.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)/)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const qualityFormats = {
      '144p': 'worst[height<=144]',
      '240p': 'worst[height<=240]',
      '360p': 'best[height<=360]',
      '480p': 'best[height<=480]',
      '720p': 'best[height<=720]',
      '1080p': 'best[height<=1080]',
      '1440p': 'best[height<=1440]',
      '2160p': 'best[height<=2160]'
    };

    const format = qualityFormats[quality];
    if (!format) {
      return res.status(400).json({ 
        error: 'Invalid quality. Supported: 144p, 240p, 360p, 480p, 720p, 1080p, 1440p, 2160p' 
      });
    }

    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true
    });

    const filename = `${info.title.replace(/[^a-zA-Z0-9]/g, '_')}_${quality}.%(ext)s`;
    const outputPath = path.join(downloadsDir, filename);

    await youtubedl(url, {
      format: format,
      output: outputPath,
      noCheckCertificates: true,
      noWarnings: true
    });

    const actualFilename = filename.replace('%(ext)s', 'mp4');
    const filePath = path.join(downloadsDir, actualFilename);

    if (!fs.existsSync(filePath)) {
      const files = fs.readdirSync(downloadsDir);
      const matchingFile = files.find(file => 
        file.startsWith(info.title.replace(/[^a-zA-Z0-9]/g, '_'))
      );
      if (matchingFile) {
        const actualPath = path.join(downloadsDir, matchingFile);
        const fileStats = fs.statSync(actualPath);
        
        res.json({
          success: true,
          message: 'Video downloaded successfully',
          filename: matchingFile,
          path: actualPath,
          size: Math.round((fileStats.size / 1024 / 1024) * 100) / 100 + ' MB',
          title: info.title,
          quality: quality
        });
        return;
      }
    }

    if (fs.existsSync(filePath)) {
      const fileStats = fs.statSync(filePath);
      
      res.json({
        success: true,
        message: 'Video downloaded successfully',
        filename: actualFilename,
        path: filePath,
        size: Math.round((fileStats.size / 1024 / 1024) * 100) / 100 + ' MB',
        title: info.title,
        quality: quality
      });
    } else {
      res.status(500).json({ error: 'Downloaded file not found' });
    }

  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({ error: 'Failed to download video', details: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'YouTube Downloader API is running' });
});

app.listen(PORT, () => {
  console.log(`YouTube Downloader API running on http://127.0.0.1:${PORT}`);
  console.log(`Example: POST http://127.0.0.1:${PORT}/download/1080p with {"url":"https://youtu.be/EqSzJbt5G9E"}`);
});

module.exports = app;