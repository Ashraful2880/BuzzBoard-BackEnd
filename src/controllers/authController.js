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

  if (user && !user.password) {
    res.status(401);
    throw new Error(
      `This account is linked with ${user.authProvider || "OAuth"}. Please continue with ${user.authProvider || "OAuth"}.`
    );
  }

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

// ============================================================================
// OAuth 2.0 Helpers & Handlers (Google & GitHub)
// ============================================================================

const getFrontendBaseUrl = () => {
  const url = process.env.FRONTEND_URL || "http://localhost:3000";
  return url.replace(/\/+$/, "");
};

const getServerBaseUrl = (req) => {
  if (process.env.SERVER_URL) {
    return process.env.SERVER_URL.replace(/\/+$/, "");
  }
  return `${req.protocol}://${req.get("host")}`;
};

const findOrCreateOAuthUser = async ({
  name,
  email,
  avatarUrl,
  provider,
  providerId,
  githubUrl,
}) => {
  const normalizedEmail = String(email).toLowerCase().trim();
  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: String(name || normalizedEmail.split("@")[0]).trim(),
        email: normalizedEmail,
        password: null,
        authProvider: provider,
        providerId: String(providerId),
        isVerified: true,
        profileImg: {
          url: avatarUrl || "",
          public_id: "",
        },
        socialLinks: {
          twitter: "",
          linkedin: "",
          github: githubUrl || "",
        },
      },
    });
  } else {
    const updatePayload = {};
    if (!user.isVerified) updatePayload.isVerified = true;
    if (!user.providerId && providerId) {
      updatePayload.providerId = String(providerId);
    }
    if (
      avatarUrl &&
      (!user.profileImg || !user.profileImg.url)
    ) {
      updatePayload.profileImg = { url: avatarUrl, public_id: "" };
    }
    if (githubUrl && (!user.socialLinks || !user.socialLinks.github)) {
      updatePayload.socialLinks = {
        ...(user.socialLinks || {}),
        github: githubUrl,
      };
    }

    if (Object.keys(updatePayload).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updatePayload,
      });
    }
  }

  return user;
};

// @desc    Redirect to Google OAuth consent screen
// @route   GET /api/v1/auth/google
// @access  Public
const googleAuthRedirect = (req, res) => {
  const frontendUrl = getFrontendBaseUrl();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.redirect(
      `${frontendUrl}/login?oauth_error=${encodeURIComponent(
        "Google OAuth is not configured on the server."
      )}`
    );
  }

  const callbackUrl =
    process.env.GOOGLE_CALLBACK_URL ||
    `${getServerBaseUrl(req)}/api/v1/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};

// @desc    Google OAuth callback
// @route   GET /api/v1/auth/google/callback
// @access  Public
const googleAuthCallback = async (req, res) => {
  const frontendUrl = getFrontendBaseUrl();
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect(
      `${frontendUrl}/login?oauth_error=${encodeURIComponent(
        "Google sign-in was cancelled or failed."
      )}`
    );
  }

  try {
    const callbackUrl =
      process.env.GOOGLE_CALLBACK_URL ||
      `${getServerBaseUrl(req)}/api/v1/auth/google/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || "Failed to obtain Google token");
    }

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await userRes.json();

    if (!profile.email) {
      throw new Error("Google account did not return an email address");
    }

    const user = await findOrCreateOAuthUser({
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.picture,
      provider: "google",
      providerId: profile.id,
    });

    const jwtToken = generateToken(user.id);
    return res.redirect(
      `${frontendUrl}/auth/callback?token=${encodeURIComponent(jwtToken)}`
    );
  } catch (err) {
    return res.redirect(
      `${frontendUrl}/login?oauth_error=${encodeURIComponent(
        err.message || "Google authentication failed."
      )}`
    );
  }
};

// @desc    Redirect to GitHub OAuth consent screen
// @route   GET /api/v1/auth/github
// @access  Public
const githubAuthRedirect = (req, res) => {
  const frontendUrl = getFrontendBaseUrl();
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.redirect(
      `${frontendUrl}/login?oauth_error=${encodeURIComponent(
        "GitHub OAuth is not configured on the server."
      )}`
    );
  }

  const callbackUrl =
    process.env.GITHUB_CALLBACK_URL ||
    `${getServerBaseUrl(req)}/api/v1/auth/github/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: "read:user user:email",
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
};

// @desc    GitHub OAuth callback
// @route   GET /api/v1/auth/github/callback
// @access  Public
const githubAuthCallback = async (req, res) => {
  const frontendUrl = getFrontendBaseUrl();
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect(
      `${frontendUrl}/login?oauth_error=${encodeURIComponent(
        "GitHub sign-in was cancelled or failed."
      )}`
    );
  }

  try {
    const callbackUrl =
      process.env.GITHUB_CALLBACK_URL ||
      `${getServerBaseUrl(req)}/api/v1/auth/github/callback`;

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: String(code),
        redirect_uri: callbackUrl,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || "Failed to obtain GitHub token");
    }

    const ghHeaders = {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "BuzzBoard-Server",
    };

    const userRes = await fetch("https://api.github.com/user", {
      headers: ghHeaders,
    });
    const profile = await userRes.json();

    let email = profile.email;
    if (!email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: ghHeaders,
      });
      const emails = await emailsRes.json();
      if (Array.isArray(emails)) {
        const primary =
          emails.find((e) => e.primary && e.verified) ||
          emails.find((e) => e.verified) ||
          emails[0];
        email = primary?.email;
      }
    }

    if (!email) {
      throw new Error("GitHub account did not return a verified email address");
    }

    const user = await findOrCreateOAuthUser({
      name: profile.name || profile.login,
      email,
      avatarUrl: profile.avatar_url,
      provider: "github",
      providerId: profile.id,
      githubUrl: profile.html_url,
    });

    const jwtToken = generateToken(user.id);
    return res.redirect(
      `${frontendUrl}/auth/callback?token=${encodeURIComponent(jwtToken)}`
    );
  } catch (err) {
    return res.redirect(
      `${frontendUrl}/login?oauth_error=${encodeURIComponent(
        err.message || "GitHub authentication failed."
      )}`
    );
  }
};

module.exports = {
  loginUser,
  updateUser,
  registerUser,
  getUserProfile,
  googleAuthRedirect,
  googleAuthCallback,
  githubAuthRedirect,
  githubAuthCallback,
};
