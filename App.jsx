import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

// =====================================
// CLOUDINARY
// =====================================

const CLOUDINARY_CLOUD_NAME = "p0nzpu9u";
const CLOUDINARY_UPLOAD_PRESET = "findback_upload";

const BACKEND_URL = "http://localhost:5000";

// =====================================
// AI MATCHING ENGINE
// =====================================

const STOP_WORDS = new Set([
  "the",
  "and",
  "with",
  "from",
  "this",
  "that",
  "item",
  "was",
  "lost",
  "found",
  "near",
  "at",
  "in",
  "on",
  "for",
  "a",
  "an",
  "of",
  "to",
  "is",
  "my",
]);

const normalizeWords = (value = "") => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 2 &&
        !STOP_WORDS.has(word)
    );
};

const uniqueWords = (words) => {
  return [...new Set(words)];
};

// =====================================
// TEXT SIMILARITY
// =====================================

const calculateTextSimilarity = (text1 = "", text2 = "") => {
  const words1 = uniqueWords(normalizeWords(text1));
  const words2 = new Set(uniqueWords(normalizeWords(text2)));

  if (words1.length === 0) return 0;

  const commonWords = words1.filter((word) =>
    words2.has(word)
  );

  return Math.round(
    (commonWords.length / words1.length) * 100
  );
};

// =====================================
// LOCATION MATCH
// =====================================

const calculateLocationSimilarity = (
  location1 = "",
  location2 = ""
) => {
  const words1 = uniqueWords(
    normalizeWords(location1)
  );

  const words2 = new Set(
    uniqueWords(normalizeWords(location2))
  );

  if (words1.length === 0) return 0;

  const common = words1.filter((word) =>
    words2.has(word)
  );

  return Math.round(
    (common.length / words1.length) * 100
  );
};

// =====================================
// DATE MATCH
// =====================================

const calculateDateSimilarity = (
  date1 = "",
  date2 = ""
) => {
  if (!date1 || !date2) return 0;

  if (date1 === date2) return 100;

  const first = new Date(date1);
  const second = new Date(date2);

  if (
    Number.isNaN(first.getTime()) ||
    Number.isNaN(second.getTime())
  ) {
    return 0;
  }

  const difference =
    Math.abs(first - second) /
    (1000 * 60 * 60 * 24);

  if (difference <= 1) return 100;
  if (difference <= 3) return 80;
  if (difference <= 7) return 60;
  if (difference <= 14) return 35;

  return 0;
};

// =====================================
// COMPLETE AI MATCH SCORE
// =====================================

const calculateMatch = (lostReport, foundReport) => {
  const nameScore = calculateTextSimilarity(
    lostReport.itemName,
    foundReport.itemName
  );

  const descriptionScore =
    calculateTextSimilarity(
      `${lostReport.itemName} ${lostReport.description}`,
      `${foundReport.itemName} ${foundReport.description}`
    );

  const locationScore =
    calculateLocationSimilarity(
      lostReport.location,
      foundReport.location
    );

  const dateScore = calculateDateSimilarity(
    lostReport.date,
    foundReport.date
  );

  const imageScore =
    lostReport.imageUrl &&
    foundReport.imageUrl
      ? 100
      : 0;

  // Weighted intelligent score
  const finalScore = Math.round(
    nameScore * 0.35 +
      descriptionScore * 0.25 +
      locationScore * 0.20 +
      dateScore * 0.10 +
      imageScore * 0.10
  );

  const reasons = [];

  if (nameScore >= 70) {
    reasons.push(
      "Item name is highly similar"
    );
  } else if (nameScore >= 30) {
    reasons.push(
      "Item name contains related keywords"
    );
  }

  if (descriptionScore >= 70) {
    reasons.push(
      "Description contains many matching details"
    );
  } else if (descriptionScore >= 30) {
    reasons.push(
      "Description has related information"
    );
  }

  if (locationScore >= 70) {
    reasons.push(
      "Same or very similar location"
    );
  } else if (locationScore >= 30) {
    reasons.push(
      "Location contains related terms"
    );
  }

  if (dateScore >= 80) {
    reasons.push(
      "Reported around the same date"
    );
  }

  if (imageScore === 100) {
    reasons.push(
      "Both reports contain item images"
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      "Some report details are related"
    );
  }

  return {
    score: Math.min(finalScore, 99),
    reasons,
    breakdown: {
      name: nameScore,
      description: descriptionScore,
      location: locationScore,
      date: dateScore,
      image: imageScore,
    },
  };
};

// =====================================
// MAIN APP
// =====================================

function App() {
  // ===================================
  // STATES
  // ===================================

  const [showForm, setShowForm] =
    useState(false);

  const [formType, setFormType] =
    useState("lost");

  const [image, setImage] =
    useState(null);

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [submitted, setSubmitted] =
    useState(false);

  const [reports, setReports] =
    useState([]);

  const [uploading, setUploading] =
    useState(false);

  const [showLogin, setShowLogin] =
    useState(false);

  const [isLoggedIn, setIsLoggedIn] =
    useState(false);

  const [userEmail, setUserEmail] =
    useState("");

  const [showReports, setShowReports] =
    useState(false);

  // AI MATCH STATES
  const [showMatches, setShowMatches] =
    useState(false);

  const [selectedReport, setSelectedReport] =
    useState(null);

  const [selectedMatchedReport, setSelectedMatchedReport] =
    useState(null);

  // DETAILS
  const [showDetails, setShowDetails] =
    useState(false);

  const [detailsReport, setDetailsReport] =
    useState(null);

  // DASHBOARD
  const [showDashboard, setShowDashboard] =
    useState(false);

  // ===================================
  // FORM DATA
  // ===================================

  const [formData, setFormData] =
    useState({
      itemName: "",
      description: "",
      location: "",
      date: "",
      contact: "",
    });

  // ===================================
  // LOAD DATA
  // ===================================

  useEffect(() => {
    try {
      const savedReports =
        localStorage.getItem(
          "findbackReports"
        );

      if (savedReports) {
        const parsed =
          JSON.parse(savedReports);

        if (Array.isArray(parsed)) {
          setReports(parsed);
        }
      }

      const loggedUser =
        localStorage.getItem(
          "findbackUser"
        );

      if (loggedUser) {
        setIsLoggedIn(true);
        setUserEmail(loggedUser);
      }
    } catch (error) {
      console.error(
        "Error loading data:",
        error
      );
    }
  }, []);

  // ===================================
  // SAVE REPORTS
  // ===================================

  const saveReports = (updatedReports) => {
    setReports(updatedReports);

    localStorage.setItem(
      "findbackReports",
      JSON.stringify(updatedReports)
    );
  };

  // ===================================
  // DASHBOARD STATS
  // ===================================

  const stats = useMemo(() => {
    return {
      total: reports.length,

      lost: reports.filter(
        (r) => r.type === "lost"
      ).length,

      found: reports.filter(
        (r) => r.type === "found"
      ).length,

      active: reports.filter(
        (r) => r.status === "Active"
      ).length,

      matched: reports.filter(
        (r) => r.status === "Matched"
      ).length,

      resolved: reports.filter(
        (r) => r.status === "Resolved"
      ).length,
    };
  }, [reports]);

  // ===================================
  // INPUT
  // ===================================

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]:
        e.target.value,
    });
  };

  // ===================================
  // OPEN REPORT FORM
  // ===================================

  const openReportForm = (type) => {
    setFormType(type);
    setShowForm(true);
    setSubmitted(false);

    setFormData({
      itemName: "",
      description: "",
      location: "",
      date: "",
      contact: "",
    });

    setImage(null);
    setSelectedFile(null);
  };

  // ===================================
  // IMAGE SELECT
  // ===================================

  const handleImageChange = (e) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert(
        "Please select an image file."
      );
      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      alert(
        "Image should be smaller than 5MB."
      );
      return;
    }

    setSelectedFile(file);

    setImage(
      URL.createObjectURL(file)
    );
  };

  // ===================================
  // CLOUDINARY UPLOAD
  // ===================================

  const uploadToCloudinary = async () => {
    if (!selectedFile) {
      return "";
    }

    const data = new FormData();

    data.append(
      "file",
      selectedFile
    );

    data.append(
      "upload_preset",
      CLOUDINARY_UPLOAD_PRESET
    );

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: data,
      }
    );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error?.message ||
          "Image upload failed"
      );
    }

    return result.secure_url;
  };

  // ===================================
  // SUBMIT REPORT
  // ===================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setUploading(true);

      let imageUrl = "";

      if (selectedFile) {
        imageUrl =
          await uploadToCloudinary();
      }

      const newReport = {
        id: Date.now(),

        type: formType,

        itemName:
          formData.itemName.trim(),

        description:
          formData.description.trim(),

        location:
          formData.location.trim(),

        date: formData.date,

        contact:
          formData.contact.trim(),

        imageUrl,

        status: "Active",

        createdAt:
          new Date().toISOString(),
      };

      const updatedReports = [
        newReport,
        ...reports,
      ];

      saveReports(updatedReports);

      // BACKEND
      try {
        await fetch(
          `${BACKEND_URL}/api/lost-items`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              item_name:
                formData.itemName,

              description:
                formData.description,

              location:
                formData.location,

              date_lost:
                formData.date,

              image_url:
                imageUrl,

              status: "Active",
            }),
          }
        );
      } catch (backendError) {
        console.log(
          "Backend unavailable. Saved locally."
        );
      }

      setSubmitted(true);
    } catch (error) {
      console.error(error);

      alert(
        error.message ||
          "Something went wrong."
      );
    } finally {
      setUploading(false);
    }
  };

  // ===================================
  // LOGIN
  // ===================================

  const handleLogin = (e) => {
    e.preventDefault();

    if (!userEmail.trim()) {
      alert(
        "Please enter your email."
      );
      return;
    }

    localStorage.setItem(
      "findbackUser",
      userEmail.trim()
    );

    setIsLoggedIn(true);

    setShowLogin(false);
  };

  // ===================================
  // LOGOUT
  // ===================================

  const handleLogout = () => {
    localStorage.removeItem(
      "findbackUser"
    );

    setIsLoggedIn(false);
    setUserEmail("");
  };

  // ===================================
  // DELETE
  // ===================================

  const deleteReport = (id) => {
    const confirmDelete =
      window.confirm(
        "Are you sure you want to remove this report?"
      );

    if (!confirmDelete) return;

    const updatedReports =
      reports.filter(
        (report) =>
          report.id !== id
      );

    saveReports(updatedReports);
  };

  // ===================================
  // AI MATCHES
  // ===================================

  const getMatches = (report) => {
    if (!report) return [];

    return reports
      .filter(
        (other) =>
          other.id !== report.id &&
          other.type !== report.type &&
          other.status !== "Resolved"
      )
      .map((other) => ({
        ...other,

        match: calculateMatch(
          report,
          other
        ),
      }))
      .filter(
        (match) =>
          match.match.score >= 20
      )
      .sort(
        (a, b) =>
          b.match.score -
          a.match.score
      );
  };

  // ===================================
  // OPEN MATCH POPUP
  // ===================================

  const openMatches = (report) => {
    setSelectedReport(report);
    setSelectedMatchedReport(null);
    setShowMatches(true);
  };

  const closeMatches = () => {
    setShowMatches(false);
    setSelectedReport(null);
    setSelectedMatchedReport(null);
  };

  // ===================================
  // CONTACT OWNER
  // ===================================

  const contactOwner = (contact) => {
    if (!contact) {
      alert("Contact information unavailable.");
      return;
    }

    const value = contact.trim();

    if (value.includes("@")) {
      window.location.href =
        `mailto:${value}`;
      return;
    }

    const phone =
      value.replace(
        /[^\d+]/g,
        ""
      );

    if (phone.length >= 8) {
      window.location.href =
        `tel:${phone}`;
      return;
    }

    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        alert(
          "Contact copied to clipboard."
        );
      })
      .catch(() => {
        alert(
          `Contact: ${value}`
        );
      });
  };

  // ===================================
  // UPDATE STATUS
  // ACTIVE -> MATCHED -> RESOLVED
  // ===================================

  const updateStatus = (
    id,
    newStatus
  ) => {
    const updatedReports =
      reports.map((report) =>
        report.id === id
          ? {
              ...report,
              status: newStatus,
            }
          : report
      );

    saveReports(updatedReports);

    if (
      selectedReport &&
      selectedReport.id === id
    ) {
      setSelectedReport({
        ...selectedReport,
        status: newStatus,
      });
    }
  };

  // ===================================
  // MARK MATCHED
  // ===================================

  const markAsMatched = (
    originalReport,
    matchedReport
  ) => {
    const updatedReports =
      reports.map((report) => {
        if (
          report.id ===
          originalReport.id
        ) {
          return {
            ...report,
            status: "Matched",
          };
        }

        if (
          report.id ===
          matchedReport.id
        ) {
          return {
            ...report,
            status: "Matched",
          };
        }

        return report;
      });

    saveReports(updatedReports);

    setSelectedMatchedReport(
      matchedReport
    );
  };

  // ===================================
  // MARK RESOLVED
  // ===================================

  const markResolved = (id) => {
    updateStatus(
      id,
      "Resolved"
    );
  };

  // ===================================
  // DETAILS
  // ===================================

  const openDetails = (report) => {
    setDetailsReport(report);
    setShowDetails(true);
  };

  // ===================================
  // CLOSE REPORT FORM
  // ===================================

  const closeReportForm = () => {
    setShowForm(false);
    setSubmitted(false);
    setImage(null);
    setSelectedFile(null);
  };

  // ===================================
  // JSX
  // ===================================

  return (
    <div className="app">

      {/* ================= NAVBAR ================= */}

      <nav className="navbar">

        <div
          className="logo"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            })
          }
        >
          <span className="logo-icon">
            🔎
          </span>

          <span>
            FindBack <b>AI</b>
          </span>
        </div>

        <div className="nav-links">
          <a href="#home">
            Home
          </a>

          <a href="#how">
            How It Works
          </a>

          <a href="#features">
            Features
          </a>

          <a href="#reports">
            Reports
          </a>

          <a href="#about">
            About
          </a>
        </div>

        <div className="nav-right">

          {isLoggedIn ? (
            <div className="user-area">

              <span className="user-email">
                👤 {userEmail}
              </span>

              <button
                className="logout-btn"
                onClick={handleLogout}
              >
                Logout
              </button>

            </div>
          ) : (
            <button
              className="login-btn"
              onClick={() =>
                setShowLogin(true)
              }
            >
              Login
            </button>
          )}

        </div>
      </nav>

      {/* ================= HERO ================= */}

      <section
        className="hero"
        id="home"
      >

        <div className="hero-content">

          <div className="hero-badge">
            ✨ AI-Powered Lost & Found Platform
          </div>

          <h1>
            Find Lost Items
            <br />

            <span>
              Faster with AI.
            </span>
          </h1>

          <p className="hero-description">
            Report a lost or found item,
            upload its image and discover
            intelligent potential matches
            using item details, location
            and date.
          </p>

          <div className="hero-buttons">

            <button
              className="primary-btn"
              onClick={() =>
                openReportForm("lost")
              }
            >
              🔍 Report Lost Item
            </button>

            <button
              className="secondary-btn"
              onClick={() =>
                openReportForm("found")
              }
            >
              📦 Report Found Item
            </button>

          </div>

          <div className="hero-points">

            <span>
              🔒 Safe & Secure
            </span>

            <span>
              🤖 Smart Matching
            </span>

            <span>
              ⚡ Fast Search
            </span>

          </div>

        </div>

        <div className="hero-visual">

          <div className="visual-glow"></div>

          <div className="phone-card">

            <div className="phone-top"></div>

            <div className="phone-screen">

              <div className="search-line"></div>

              <div className="item-circle">
                🎒
              </div>

              <div className="scan-line"></div>

            </div>
          </div>

          <div className="floating-card card-one">
            🎧
          </div>

          <div className="floating-card card-two">
            🎒
          </div>

          <div className="ai-match">
            ✨ AI Matching...
          </div>

          <div className="match-circle">
            🔍
          </div>

        </div>

      </section>

      {/* ================= LIVE STATS ================= */}

      <section className="stats">

        <div className="stat-card">
          <div className="stat-icon">
            📊
          </div>

          <h3>
            {stats.total}
          </h3>

          <p>
            Total Reports
          </p>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            🔍
          </div>

          <h3>
            {stats.lost}
          </h3>

          <p>
            Lost Items
          </p>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            📦
          </div>

          <h3>
            {stats.found}
          </h3>

          <p>
            Found Items
          </p>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            🤝
          </div>

          <h3>
            {stats.matched}
          </h3>

          <p>
            Matched
          </p>
        </div>

      </section>

      {/* ================= HOW IT WORKS ================= */}

      <section
        className="section"
        id="how"
      >

        <div className="section-heading">

          <span className="small-heading">
            HOW IT WORKS
          </span>

          <h2>
            Finding your item is
            <span> simple.</span>
          </h2>

          <p>
            Report, match and reconnect
            in simple steps.
          </p>

        </div>

        <div className="steps">

          <div className="step-card">

            <div className="step-number">
              01
            </div>

            <div className="step-icon">
              📸
            </div>

            <h3>
              Report
            </h3>

            <p>
              Upload your lost or found
              item with details.
            </p>

          </div>

          <div className="step-arrow">
            →
          </div>

          <div className="step-card">

            <div className="step-number">
              02
            </div>

            <div className="step-icon">
              🤖
            </div>

            <h3>
              AI Match
            </h3>

            <p>
              Find potential matches using
              multiple report signals.
            </p>

          </div>

          <div className="step-arrow">
            →
          </div>

          <div className="step-card">

            <div className="step-number">
              03
            </div>

            <div className="step-icon">
              📊
            </div>

            <h3>
              Review
            </h3>

            <p>
              Check match percentage
              and reasons.
            </p>

          </div>

          <div className="step-arrow">
            →
          </div>

          <div className="step-card">

            <div className="step-number">
              04
            </div>

            <div className="step-icon">
              🤝
            </div>

            <h3>
              Reconnect
            </h3>

            <p>
              Contact the owner and
              resolve the report.
            </p>

          </div>

        </div>
      </section>

      {/* ================= FEATURES ================= */}

      <section
        className="features-section"
        id="features"
      >

        <div className="section-heading">

          <span className="small-heading">
            POWERFUL FEATURES
          </span>

          <h2>
            Built to make
            <span> finding easier.</span>
          </h2>

        </div>

        <div className="feature-grid">

          <div className="feature-card">

            <div className="feature-icon purple">
              🤖
            </div>

            <h3>
              Intelligent Matching
            </h3>

            <p>
              Compare item names,
              descriptions, locations,
              dates and images.
            </p>

          </div>

          <div className="feature-card">

            <div className="feature-icon blue">
              📊
            </div>

            <h3>
              Match Percentage
            </h3>

            <p>
              Every potential match
              receives a transparent
              percentage score.
            </p>

          </div>

          <div className="feature-card">

            <div className="feature-icon pink">
              📞
            </div>

            <h3>
              Contact Owner
            </h3>

            <p>
              Quickly contact the
              reporter through phone
              or email.
            </p>

          </div>

          <div className="feature-card">

            <div className="feature-icon green">
              🔄
            </div>

            <h3>
              Status Tracking
            </h3>

            <p>
              Track reports from Active
              to Matched and Resolved.
            </p>

          </div>

        </div>

      </section>

      {/* ================= DASHBOARD ================= */}

      <section className="dashboard-section">

        <div className="dashboard-header">

          <div>
            <span className="small-heading">
              LIVE DASHBOARD
            </span>

            <h2>
              FindBack Overview
            </h2>
          </div>

          <button
            className="view-btn"
            onClick={() =>
              setShowDashboard(
                !showDashboard
              )
            }
          >
            {showDashboard
              ? "Hide Dashboard"
              : "Open Dashboard"}
          </button>

        </div>

        {showDashboard && (

          <div className="dashboard-grid">

            <div className="dashboard-card">
              <span>
                Total Reports
              </span>

              <strong>
                {stats.total}
              </strong>

              <small>
                All reports
              </small>
            </div>

            <div className="dashboard-card">
              <span>
                Lost
              </span>

              <strong>
                {stats.lost}
              </strong>

              <small>
                Lost items
              </small>
            </div>

            <div className="dashboard-card">
              <span>
                Found
              </span>

              <strong>
                {stats.found}
              </strong>

              <small>
                Found items
              </small>
            </div>

            <div className="dashboard-card">
              <span>
                Active
              </span>

              <strong>
                {stats.active}
              </strong>

              <small>
                Active reports
              </small>
            </div>

            <div className="dashboard-card">
              <span>
                Matched
              </span>

              <strong>
                {stats.matched}
              </strong>

              <small>
                Potentially connected
              </small>
            </div>

            <div className="dashboard-card">
              <span>
                Resolved
              </span>

              <strong>
                {stats.resolved}
              </strong>

              <small>
                Completed reports
              </small>
            </div>

          </div>
        )}

      </section>

      {/* ================= REPORTS ================= */}

      <section
        className="reports-section"
        id="reports"
      >

        <div className="reports-header">

          <div>

            <span className="small-heading">
              COMMUNITY REPORTS
            </span>

            <h2>
              Recent Lost & Found Items
            </h2>

          </div>

          <button
            className="view-btn"
            onClick={() =>
              setShowReports(
                !showReports
              )
            }
          >
            {showReports
              ? "Hide Reports"
              : "View Reports"}
          </button>

        </div>

        {showReports && (

          <div className="reports-grid">

            {reports.length === 0 ? (

              <div className="empty-reports">

                <div>
                  🔍
                </div>

                <h3>
                  No reports yet
                </h3>

                <p>
                  Be the first person
                  to report an item.
                </p>

              </div>

            ) : (

              reports.map((report) => (

                <div
                  className="report-card"
                  key={report.id}
                >

                  {report.imageUrl ? (

                    <img
                      src={report.imageUrl}
                      alt={report.itemName}
                    />

                  ) : (

                    <div className="no-image">
                      📦
                    </div>

                  )}

                  <div className="report-info">

                    <div className="report-badges">

                      <span
                        className={
                          report.type === "lost"
                            ? "lost-tag"
                            : "found-tag"
                        }
                      >
                        {report.type === "lost"
                          ? "LOST"
                          : "FOUND"}
                      </span>

                      <span
                        className={
                          `status-badge status-${String(
                            report.status
                          ).toLowerCase()}`
                        }
                      >
                        {report.status}
                      </span>

                    </div>

                    <h3>
                      {report.itemName}
                    </h3>

                    <p>
                      {report.description}
                    </p>

                    <div className="report-location">
                      📍 {report.location}
                    </div>

                    <div className="report-extra">
                      📅 {report.date}
                    </div>

                    {/* ACTION BUTTONS */}

                    <div className="report-actions">

                      <button
                        className="match-report-btn"
                        onClick={() =>
                          openMatches(report)
                        }
                      >
                        🤖 Find Matches
                      </button>

                      <button
                        className="details-btn"
                        onClick={() =>
                          openDetails(report)
                        }
                      >
                        View
                      </button>

                      <button
                        className="delete-report"
                        onClick={() =>
                          deleteReport(
                            report.id
                          )
                        }
                      >
                        Remove
                      </button>

                    </div>

                    {/* STATUS */}

                    <div className="status-actions">

                      {report.status ===
                        "Active" && (

                        <button
                          onClick={() =>
                            updateStatus(
                              report.id,
                              "Matched"
                            )
                          }
                        >
                          🤝 Mark Matched
                        </button>

                      )}

                      {report.status ===
                        "Matched" && (

                        <button
                          onClick={() =>
                            markResolved(
                              report.id
                            )
                          }
                        >
                          ✓ Mark Resolved
                        </button>

                      )}

                      {report.status !==
                        "Active" && (

                        <button
                          onClick={() =>
                            updateStatus(
                              report.id,
                              "Active"
                            )
                          }
                        >
                          ↩ Reopen
                        </button>

                      )}

                    </div>

                  </div>

                </div>

              ))

            )}

          </div>

        )}

      </section>

      {/* ================= ABOUT ================= */}

      <section
        className="about-section"
        id="about"
      >

        <div className="about-content">

          <span className="small-heading">
            ABOUT FINDBACK AI
          </span>

          <h2>
            Technology that helps
            people
            <span>
              reconnect.
            </span>
          </h2>

          <p>
            FindBack AI is a smart lost
            and found platform designed
            to make item recovery faster
            and easier.
          </p>

          <p>
            Users can report lost or found
            items, upload images and
            discover potential matches
            through intelligent comparison.
          </p>

        </div>

        <div className="about-card">

          <div className="about-card-icon">
            ✨
          </div>

          <h3>
            Find it.
            <br />
            Match it.
            <br />
            Get it back.
          </h3>

          <p>
            Powered by smart matching.
          </p>

        </div>

      </section>

      {/* ================= FOOTER ================= */}

      <footer>

        <div className="footer-logo">
          🔎 FindBack <b>AI</b>
        </div>

        <p>
          Making lost & found smarter with AI.
        </p>

        <div className="footer-line"></div>

        <span>
          © 2026 FindBack AI.
          Built for Hackathon.
        </span>

      </footer>

      {/* ================= LOGIN MODAL ================= */}

      {showLogin && (

        <div
          className="modal-overlay"
          onClick={() =>
            setShowLogin(false)
          }
        >

          <div
            className="login-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <button
              className="close-modal"
              onClick={() =>
                setShowLogin(false)
              }
            >
              ×
            </button>

            <div className="login-icon">
              🔐
            </div>

            <h2>
              Welcome Back!
            </h2>

            <p className="login-subtitle">
              Login to continue with
              FindBack AI
            </p>

            <form
              onSubmit={handleLogin}
            >

              <label>
                Email Address
              </label>

              <input
                type="email"
                placeholder="Enter your email"
                value={userEmail}
                onChange={(e) =>
                  setUserEmail(
                    e.target.value
                  )
                }
                required
              />

              <label>
                Password
              </label>

              <input
                type="password"
                placeholder="Enter password"
                required
              />

              <button
                type="submit"
                className="login-submit"
              >
                Login →
              </button>

            </form>

          </div>

        </div>

      )}

      {/* ================= REPORT MODAL ================= */}

      {showForm && (

        <div
          className="modal-overlay"
          onClick={closeReportForm}
        >

          <div
            className="report-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <button
              className="close-modal"
              onClick={closeReportForm}
            >
              ×
            </button>

            {!submitted ? (

              <>

                <div className="modal-title">

                  <div className="modal-title-icon">
                    {formType === "lost"
                      ? "🔍"
                      : "📦"}
                  </div>

                  <div>

                    <span>
                      REPORT ITEM
                    </span>

                    <h2>
                      {formType === "lost"
                        ? "Report Lost Item"
                        : "Report Found Item"}
                    </h2>

                  </div>

                </div>

                <form
                  onSubmit={handleSubmit}
                >

                  <label>
                    Item Name
                  </label>

                  <input
                    type="text"
                    name="itemName"
                    placeholder="e.g. Black Wallet"
                    value={
                      formData.itemName
                    }
                    onChange={
                      handleInputChange
                    }
                    required
                  />

                  <label>
                    Description
                  </label>

                  <textarea
                    name="description"
                    placeholder="Describe the item..."
                    value={
                      formData.description
                    }
                    onChange={
                      handleInputChange
                    }
                    required
                  />

                  <div className="form-row">

                    <div>

                      <label>
                        Location
                      </label>

                      <input
                        type="text"
                        name="location"
                        placeholder="Where?"
                        value={
                          formData.location
                        }
                        onChange={
                          handleInputChange
                        }
                        required
                      />

                    </div>

                    <div>

                      <label>
                        Date
                      </label>

                      <input
                        type="date"
                        name="date"
                        value={
                          formData.date
                        }
                        onChange={
                          handleInputChange
                        }
                        required
                      />

                    </div>

                  </div>

                  <label>
                    Contact
                  </label>

                  <input
                    type="text"
                    name="contact"
                    placeholder="Email or phone number"
                    value={
                      formData.contact
                    }
                    onChange={
                      handleInputChange
                    }
                    required
                  />

                  <label>
                    Item Image
                  </label>

                  <div className="upload-box">

                    <input
                      type="file"
                      accept="image/*"
                      onChange={
                        handleImageChange
                      }
                    />

                    <div className="upload-content">

                      {image ? (

                        <img
                          src={image}
                          alt="Preview"
                          className="image-preview"
                        />

                      ) : (

                        <>

                          <div className="upload-icon">
                            📸
                          </div>

                          <p>
                            Click to upload image
                          </p>

                          <small>
                            JPG, PNG or WEBP
                          </small>

                        </>

                      )}

                    </div>

                  </div>

                  <button
                    type="submit"
                    className="submit-report"
                    disabled={uploading}
                  >
                    {uploading
                      ? "Uploading..."
                      : "Submit Report →"}
                  </button>

                </form>

              </>

            ) : (

              <div className="success-message">

                <div className="success-icon">
                  ✓
                </div>

                <h2>
                  Report Submitted!
                </h2>

                <p>
                  Your {formType} item
                  has been successfully
                  reported.
                </p>

                <p className="ai-message">
                  🤖 FindBack AI can now
                  compare this report
                  with opposite-type
                  reports.
                </p>

                <button
                  className="submit-report"
                  onClick={() => {
                    setShowForm(false);
                    setShowReports(true);
                  }}
                >
                  View Reports
                </button>

              </div>

            )}

          </div>

        </div>

      )}

      {/* ================= AI MATCH POPUP ================= */}

      {showMatches &&
        selectedReport && (

        <div
          className="modal-overlay"
          onClick={closeMatches}
        >

          <div
            className="matches-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <button
              className="close-modal"
              onClick={closeMatches}
            >
              ×
            </button>

            <div className="matches-header">

              <div className="matches-ai-icon">
                🤖
              </div>

              <div>

                <span className="small-heading">
                  AI MATCHING
                </span>

                <h2>
                  Potential Matches
                </h2>

                <p>
                  FindBack AI compared
                  this report with
                  opposite-type reports.
                </p>

              </div>

            </div>

            {getMatches(
              selectedReport
            ).length === 0 ? (

              <div className="no-matches">

                <div className="no-matches-icon">
                  🔍
                </div>

                <h3>
                  No strong matches yet
                </h3>

                <p>
                  No potential match was
                  found. Add more detailed
                  reports to improve matching.
                </p>

              </div>

            ) : (

              <div className="matches-list">

                {getMatches(
                  selectedReport
                ).map((match) => (

                  <div
                    className="match-card"
                    key={match.id}
                  >

                    <div className="match-image">

                      {match.imageUrl ? (

                        <img
                          src={match.imageUrl}
                          alt={match.itemName}
                        />

                      ) : (

                        <div className="match-no-image">
                          📦
                        </div>

                      )}

                    </div>

                    <div className="match-details">

                      <div className="match-top">

                        <span
                          className={
                            match.type === "lost"
                              ? "lost-tag"
                              : "found-tag"
                          }
                        >
                          {match.type === "lost"
                            ? "LOST"
                            : "FOUND"}
                        </span>

                        <strong className="match-score">
                          {match.match.score}%
                        </strong>

                      </div>

                      <div className="score-label">
                        MATCH CONFIDENCE
                      </div>

                      <h3>
                        {match.itemName}
                      </h3>

                      <p>
                        {match.description}
                      </p>

                      <div className="match-meta">

                        <span>
                          📍 {match.location}
                        </span>

                        <span>
                          📅 {match.date}
                        </span>

                      </div>

                      {/* MATCH REASONS */}

                      <div className="match-reasons">

                        <strong>
                          ✨ Why this may match:
                        </strong>

                        {match.match.reasons.map(
                          (reason, index) => (

                            <span
                              key={index}
                            >
                              ✓ {reason}
                            </span>

                          )
                        )}

                      </div>

                      {/* BREAKDOWN */}

                      <div className="match-breakdown">

                        <span>
                          Name{" "}
                          {match.match.breakdown.name}%
                        </span>

                        <span>
                          Details{" "}
                          {match.match.breakdown.description}%
                        </span>

                        <span>
                          Location{" "}
                          {match.match.breakdown.location}%
                        </span>

                        <span>
                          Date{" "}
                          {match.match.breakdown.date}%
                        </span>

                      </div>

                      {/* CONTACT + MATCH */}

                      <div className="match-actions">

                        <button
                          className="contact-owner-btn"
                          onClick={() =>
                            contactOwner(
                              match.contact
                            )
                          }
                        >
                          📞 Contact Owner
                        </button>

                        <button
                          className="match-status-btn"
                          onClick={() =>
                            markAsMatched(
                              selectedReport,
                              match
                            )
                          }
                        >
                          🤝 Mark Matched
                        </button>

                      </div>

                      {selectedMatchedReport?.id ===
                        match.id && (

                        <div className="matched-success">
                          ✓ Both reports are now
                          marked as Matched.
                          Contact the owner to
                          complete the recovery.
                        </div>

                      )}

                    </div>

                  </div>

                ))}

              </div>

            )}

          </div>

        </div>

      )}

      {/* ================= DETAILS POPUP ================= */}

      {showDetails &&
        detailsReport && (

        <div
          className="modal-overlay"
          onClick={() =>
            setShowDetails(false)
          }
        >

          <div
            className="details-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <button
              className="close-modal"
              onClick={() =>
                setShowDetails(false)
              }
            >
              ×
            </button>

            <span className="small-heading">
              REPORT DETAILS
            </span>

            <h2>
              {detailsReport.itemName}
            </h2>

            <div className="details-status-row">

              <span
                className={
                  detailsReport.type === "lost"
                    ? "lost-tag"
                    : "found-tag"
                }
              >
                {detailsReport.type.toUpperCase()}
              </span>

              <span
                className={
                  `status-badge status-${String(
                    detailsReport.status
                  ).toLowerCase()}`
                }
              >
                {detailsReport.status}
              </span>

            </div>

            {detailsReport.imageUrl && (

              <img
                className="details-image"
                src={detailsReport.imageUrl}
                alt={detailsReport.itemName}
              />

            )}

            <p>
              {detailsReport.description}
            </p>

            <div className="details-meta">

              <span>
                📍 {detailsReport.location}
              </span>

              <span>
                📅 {detailsReport.date}
              </span>

              <span>
                📞 {detailsReport.contact}
              </span>

            </div>

            <button
              className="contact-owner-btn"
              onClick={() =>
                contactOwner(
                  detailsReport.contact
                )
              }
            >
              📞 Contact
            </button>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;