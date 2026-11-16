const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");

// Ensure local uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Local Disk Storage for Multer (with optional Cloudinary upload helper)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  },
});

// File Filter
const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Not an image! Please upload only images."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

// Check if Cloudinary has real credentials configured
const isCloudinaryConfigured = () => {
  return (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_CLOUD_NAME !== "your_cloud_name" &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_KEY !== "your_api_key" &&
    process.env.CLOUDINARY_API_SECRET &&
    process.env.CLOUDINARY_API_SECRET !== "your_api_secret"
  );
};

// Error Handling & Optional Cloudinary Sync Wrapper
const handleUpload = (uploadMethod) => (req, res, next) => {
  uploadMethod(req, res, async function (err) {
    if (err) {
      return res.status(400).json({
        success: false,
        message: "File upload error",
        error: err.message,
      });
    }

    try {
      if (req.file) {
        if (isCloudinaryConfigured()) {
          const result = await cloudinary.uploader.upload(req.file.path, {
            folder: "buzzboard_uploads",
          });
          fs.unlink(req.file.path, () => {});
          req.file.path = result.secure_url;
          req.file.filename = result.public_id;
        } else {
          req.file.path = `/uploads/${req.file.filename}`;
        }
      }
      next();
    } catch (cloudErr) {
      return res.status(400).json({
        success: false,
        message: "Cloud image upload failed",
        error: cloudErr.message,
      });
    }
  });
};

module.exports = {
  uploadSingle: handleUpload(upload.single("image")),
  uploadMultiple: handleUpload(upload.array("images", 5)),
  isCloudinaryConfigured,
};
