const bcrypt = require("bcryptjs");
const asyncHandler = require("express-async-handler");
const { prisma } = require("../config/database");
const { generateToken } = require("../utils/generateToken");
const { serializeUser } = require("../utils/serializers");

// @desc    Register a new user
// @route   POST /api/v1/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, bio, website } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please provide name, email and password");
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const userExists = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      bio: bio || "",
      website: website || "",
    },
  });

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: {
      ...serializeUser(user),
      token: generateToken(user.id),
    },
  });
});

// @desc    Authenticate a user & get token
// @route   POST /api/v1/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (user && (await bcrypt.compare(password, user.password))) {
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        ...serializeUser(user),
        token: generateToken(user.id),
      },
    });
  } else {
    res.status(401);
    throw new Error("Invalid email or password");
  }
});

// @desc    Get current logged in user
// @route   GET /api/v1/auth/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      _count: {
        select: { followers: true, following: true, bookmarks: true },
      },
    },
  });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.status(200).json({
    success: true,
    message: "User profile retrieved successfully",
    data: {
      ...serializeUser(user),
      followersCount: user._count.followers,
      followingCount: user._count.following,
      bookmarksCount: user._count.bookmarks,
    },
  });
});

// @desc    Update user profile
// @route   PUT /api/v1/auth/profile
// @access  Private
const updateUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const updateData = {};
  if (req.body.name) updateData.name = String(req.body.name).trim();
  if (req.body.email) updateData.email = String(req.body.email).toLowerCase().trim();
  if (req.body.bio !== undefined) updateData.bio = req.body.bio;
  if (req.body.website !== undefined) updateData.website = req.body.website;

  if (req.body.socialLinks && typeof req.body.socialLinks === "object") {
    const currentLinks = user.socialLinks || {};
    updateData.socialLinks = {
      twitter: req.body.socialLinks.twitter ?? currentLinks.twitter ?? "",
      linkedin: req.body.socialLinks.linkedin ?? currentLinks.linkedin ?? "",
      github: req.body.socialLinks.github ?? currentLinks.github ?? "",
    };
  }

  if (req.file) {
    updateData.profileImg = {
      url: req.file.path,
      public_id: req.file.filename,
    };
  }

  if (req.body.password) {
    if (req.body.password.length < 6) {
      res.status(400);
      throw new Error("Password must be at least 6 characters");
    }
    const salt = await bcrypt.genSalt(10);
    updateData.password = await bcrypt.hash(req.body.password, salt);
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: updateData,
  });

  res.json({
    success: true,
    message: "User profile updated successfully",
    data: {
      ...serializeUser(updatedUser),
      token: generateToken(updatedUser.id),
    },
  });
});

module.exports = {
  loginUser,
  updateUser,
  registerUser,
  getUserProfile,
};
