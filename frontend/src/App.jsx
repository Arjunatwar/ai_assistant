import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import Login from "./Login";
import "./App.css";


// ============================================================
// CONFIG
// ============================================================

const API = import.meta.env.VITE_API_URL;

const MAX_IMAGE_COUNT = 4;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "c",
  "cpp",
  "csharp",
  "go",
  "rust",
  "php",
  "html",
  "css",
  "sql",
  "bash",
  "json",
];

const TRANSLATION_LANGUAGES = [
  "English",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Japanese",
  "Korean",
  "Chinese",
  "Arabic",
  "Russian",
];


// ============================================================
// CODE BLOCK
// ============================================================

function CodeBlock({
  inline,
  className,
  children,
  onConvert,
}) {
  const [copied, setCopied] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);

  const code = String(children).replace(/\n$/, "");

  const language =
    className?.replace("language-", "") || "";

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  if (inline) {
    return (
      <code
        className={className}
        style={{
          padding: "2px 5px",
          borderRadius: "5px",
          background: "#202027",
          fontSize: "0.9em",
        }}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="code-wrapper">
      <div className="code-actions">
        <button
          className="code-action"
          onClick={copyCode}
        >
          {copied ? "Copied" : "Copy"}
        </button>

        <button
          className="code-action"
          onClick={() =>
            setShowLanguages((previous) => !previous)
          }
        >
          Convert
        </button>

        {showLanguages && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "34px",
              zIndex: 20,
              width: "170px",
              maxHeight: "260px",
              overflowY: "auto",
              padding: "6px",
              borderRadius: "8px",
              border: "1px solid #33333d",
              background: "#18181f",
              boxShadow:
                "0 15px 40px rgba(0,0,0,.45)",
            }}
          >
            {SUPPORTED_LANGUAGES.map((item) => (
              <button
                key={item}
                onClick={() => {
                  setShowLanguages(false);
                  onConvert(code, language, item);
                }}
                style={{
                  width: "100%",
                  display: "block",
                  padding: "8px 10px",
                  border: "none",
                  borderRadius: "6px",
                  background: "transparent",
                  color: "#ccc",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background =
                    "#292932";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background =
                    "transparent";
                }}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>

      <pre>
        <code className={className}>
          {children}
        </code>
      </pre>
    </div>
  );
}


// ============================================================
// MARKDOWN MESSAGE
// ============================================================

function MarkdownMessage({
  content,
  onConvert,
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({
          inline,
          className,
          children,
        }) {
          return (
            <CodeBlock
              inline={inline}
              className={className}
              children={children}
              onConvert={onConvert}
            />
          );
        },

        a({ children, href }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#8192ff",
              }}
            >
              {children}
            </a>
          );
        },

        img({ src, alt }) {
          return (
            <img
              src={src}
              alt={alt || ""}
              style={{
                maxWidth: "100%",
                maxHeight: "500px",
                objectFit: "contain",
                borderRadius: "10px",
                marginTop: "10px",
              }}
            />
          );
        },

        table({ children }) {
          return (
            <div
              style={{
                overflowX: "auto",
                margin: "15px 0",
              }}
            >
              <table>{children}</table>
            </div>
          );
        },
      }}
    >
      {content || ""}
    </ReactMarkdown>
  );
}


// ============================================================
// APP
// ============================================================

function App() {
  // ==========================================================
  // AUTH
  // ==========================================================

  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);


  // ==========================================================
  // CHATS
  // ==========================================================

  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);

  const [loadingChats, setLoadingChats] = useState(false);


  // ==========================================================
  // INPUT
  // ==========================================================

  const [input, setInput] = useState("");
  const [images, setImages] = useState([]);

  const [loading, setLoading] = useState(false);


  // ==========================================================
  // VOICE
  // ==========================================================

  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] =
    useState(null);

  const [voiceOpen, setVoiceOpen] =
    useState(false);

  const [speaking, setSpeaking] =
    useState(false);

  const [listening, setListening] =
    useState(false);


  // ==========================================================
  // TRANSLATION
  // ==========================================================

  const [translationOpen, setTranslationOpen] =
    useState(false);

  const [translationLanguage, setTranslationLanguage] =
    useState("Hindi");

  const [translating, setTranslating] =
    useState(false);


  // ==========================================================
  // CODE
  // ==========================================================

  const [converting, setConverting] =
    useState(false);


  // ==========================================================
  // UI
  // ==========================================================

  const [mobileSidebar, setMobileSidebar] =
    useState(false);


  // ==========================================================
  // REFS
  // ==========================================================

  const fileRef = useRef(null);

  const messagesEndRef = useRef(null);

  const inputRef = useRef(null);

  const recognitionRef = useRef(null);


  // ==========================================================
  // AUTH CHECK
  // ==========================================================

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(
          `${API}/api/auth/me`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          setUser(null);
          return;
        }

        const data = await response.json();

        setUser(data.user);
      } catch (error) {
        console.error(
          "Authentication check failed:",
          error
        );

        setUser(null);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);


  // ==========================================================
  // LOAD CHATS
  // ==========================================================

  const loadChats = useCallback(async () => {
    if (!user) return;

    try {
      setLoadingChats(true);

      const response = await fetch(
        `${API}/api/chats`,
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load chats"
        );
      }

      setChats(data);

      if (data.length > 0) {
        const firstChat = data[0];

        setCurrentChat(firstChat);

        const chatResponse = await fetch(
          `${API}/api/chats/${firstChat.id}`,
          {
            credentials: "include",
          }
        );

        const chatData =
          await chatResponse.json();

        if (chatResponse.ok) {
          setMessages(chatData.messages || []);
        }
      } else {
        setCurrentChat(null);
        setMessages([]);
      }
    } catch (error) {
      console.error(
        "Load chats error:",
        error
      );
    } finally {
      setLoadingChats(false);
    }
  }, [user]);


  useEffect(() => {
    if (user) {
      loadChats();
    }
  }, [user, loadChats]);


  // ==========================================================
  // LOAD SINGLE CHAT
  // ==========================================================

  const loadChat = async (chatId) => {
    try {
      const response = await fetch(
        `${API}/api/chats/${chatId}`,
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Failed to load conversation"
        );
      }

      setCurrentChat(data.chat);
      setMessages(data.messages || []);
      setMobileSidebar(false);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error(
        "Load chat error:",
        error
      );
    }
  };


  // ==========================================================
  // CREATE NEW CHAT
  // ==========================================================

  const createChat = async () => {
    try {
      const response = await fetch(
        `${API}/api/chats`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          credentials: "include",

          body: JSON.stringify({
            context: "",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Failed to create conversation"
        );
      }

      setChats((previous) => [
        data,
        ...previous,
      ]);

      setCurrentChat(data);
      setMessages([]);
      setInput("");
      setImages([]);
      setMobileSidebar(false);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);

      return data;
    } catch (error) {
      console.error(
        "Create chat error:",
        error
      );

      alert(error.message);

      return null;
    }
  };


  // ==========================================================
  // DELETE CHAT
  // ==========================================================

  const deleteChat = async (
    chatId,
    event
  ) => {
    event?.stopPropagation();

    try {
      const response = await fetch(
        `${API}/api/chats/${chatId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Failed to delete chat"
        );
      }

      const remaining = chats.filter(
        (chat) => chat.id !== chatId
      );

      setChats(remaining);

      if (currentChat?.id === chatId) {
        if (remaining.length > 0) {
          await loadChat(remaining[0].id);
        } else {
          setCurrentChat(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error(
        "Delete chat error:",
        error
      );

      alert(error.message);
    }
  };


  // ==========================================================
  // AUTO SCROLL
  // ==========================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);


  // ==========================================================
  // VOICES
  // ==========================================================

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    const loadVoices = () => {
      const available =
        window.speechSynthesis.getVoices();

      if (!available.length) return;

      setVoices(available);

      const saved =
        localStorage.getItem(
          "selectedVoice"
        );

      const found = available.find(
        (voice) =>
          voice.name === saved
      );

      if (found) {
        setSelectedVoice(found);
      } else {
        const englishVoice =
          available.find((voice) =>
            voice.lang
              ?.toLowerCase()
              .startsWith("en")
          );

        setSelectedVoice(
          englishVoice || available[0]
        );
      }
    };

    loadVoices();

    window.speechSynthesis.onvoiceschanged =
      loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged =
        null;
    };
  }, []);


  // ==========================================================
  // SELECT VOICE
  // ==========================================================

  const chooseVoice = (voice) => {
    setSelectedVoice(voice);

    localStorage.setItem(
      "selectedVoice",
      voice.name
    );

    setVoiceOpen(false);
  };


  // ==========================================================
  // READ ALOUD
  // ==========================================================

  const readAloud = (text) => {
    if (
      !text ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(text);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setSpeaking(true);
    };

    utterance.onend = () => {
      setSpeaking(false);
    };

    utterance.onerror = () => {
      setSpeaking(false);
    };

    window.speechSynthesis.speak(
      utterance
    );
  };


  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setSpeaking(false);
  };


  // ==========================================================
  // TEST VOICE
  // ==========================================================

  const testVoice = (voice) => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        "Hello, this is your selected voice."
      );

    utterance.voice = voice;

    window.speechSynthesis.speak(
      utterance
    );
  };


  // ==========================================================
  // SPEECH RECOGNITION
  // ==========================================================

  const startListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Voice input is not supported in this browser."
      );
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    const recognition =
      new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        if (event.results[i].isFinal) {
          finalTranscript +=
            event.results[i][0].transcript;
        }
      }

      if (finalTranscript.trim()) {
        setInput((prev) => {
          const current = prev.trim();
          const newText =
            finalTranscript.trim();

          return current
            ? `${current} ${newText}`
            : newText;
        });
      }
    };

    recognition.onerror = (event) => {
      console.error(
        "Speech recognition error:",
        event.error
      );

      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current =
      recognition;

    recognition.start();
  };


  const stopListening = () => {
    recognitionRef.current?.stop();

    setListening(false);
  };


  // ==========================================================
  // IMAGE COMPRESSION
  // ==========================================================

  const compressImage = (file) => {
    return new Promise(
      (resolve, reject) => {
        if (
          file.size >
          MAX_IMAGE_SIZE
        ) {
          reject(
            new Error(
              `${file.name} is larger than 10MB.`
            )
          );

          return;
        }

        const reader =
          new FileReader();

        reader.onload = () => {
          const image = new Image();

          image.onload = () => {
            const maxDimension = 1280;

            let width = image.width;
            let height = image.height;

            if (
              width > maxDimension ||
              height > maxDimension
            ) {
              const scale =
                Math.min(
                  maxDimension / width,
                  maxDimension / height
                );

              width =
                Math.round(
                  width * scale
                );

              height =
                Math.round(
                  height * scale
                );
            }

            const canvas =
              document.createElement(
                "canvas"
              );

            canvas.width = width;
            canvas.height = height;

            const context =
              canvas.getContext("2d");

            context.drawImage(
              image,
              0,
              0,
              width,
              height
            );

            const compressed =
              canvas.toDataURL(
                "image/jpeg",
                0.75
              );

            resolve({
              name: file.name,
              data: compressed,
              preview: compressed,
            });
          };

          image.onerror = () => {
            reject(
              new Error(
                "Failed to read image."
              )
            );
          };

          image.src =
            reader.result;
        };

        reader.onerror = () => {
          reject(
            new Error(
              "Failed to load image."
            )
          );
        };

        reader.readAsDataURL(file);
      }
    );
  };


  // ==========================================================
  // FILE SELECT
  // ==========================================================

  const handleFileChange = async (
    event
  ) => {
    const files =
      Array.from(
        event.target.files || []
      );

    if (!files.length) return;

    if (
      images.length +
        files.length >
      MAX_IMAGE_COUNT
    ) {
      alert(
        `You can attach up to ${MAX_IMAGE_COUNT} images.`
      );

      event.target.value = "";

      return;
    }

    try {
      const compressedImages = [];

      for (const file of files) {
        if (
          !file.type.startsWith(
            "image/"
          )
        ) {
          alert(
            `${file.name} is not an image.`
          );

          continue;
        }

        const image =
          await compressImage(file);

        compressedImages.push(image);
      }

      setImages((previous) => [
        ...previous,
        ...compressedImages,
      ]);
    } catch (error) {
      alert(error.message);
    }

    event.target.value = "";
  };


  // ==========================================================
  // REMOVE IMAGE
  // ==========================================================

  const removeImage = (index) => {
    setImages((previous) =>
      previous.filter(
        (_, imageIndex) =>
          imageIndex !== index
      )
    );
  };


  // ==========================================================
  // SEND MESSAGE
  // ==========================================================

  const sendMessage = async () => {
    if (loading) return;

    const text =
      input.trim();

    if (
      !text &&
      images.length === 0
    ) {
      return;
    }

    let chat = currentChat;

    if (!chat) {
      chat =
        await createChat();

      if (!chat) return;
    }

    const imageCopies =
      [...images];

    const temporaryUserMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      images: imageCopies.map(
        (image) => image.preview
      ),
    };

    setMessages((previous) => [
      ...previous,
      temporaryUserMessage,
    ]);

    setInput("");
    setImages([]);

    setLoading(true);

    try {
      const response =
        await fetch(
          `${API}/api/chats/${chat.id}/message`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials: "include",

            body: JSON.stringify({
              message: text,
              images:
                imageCopies.map(
                  (image) =>
                    image.data
                ),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Failed to send message"
        );
      }

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          data.answer ||
          data.message ||
          "",
      };

      setMessages((previous) => {
        const withoutTemporary =
          previous.filter(
            (message) =>
              message.id !==
              temporaryUserMessage.id
          );

        return [
          ...withoutTemporary,

          {
            ...temporaryUserMessage,
            id:
              data.userMessageId ||
              temporaryUserMessage.id,
          },

          assistantMessage,
        ];
      });

      if (
        data.title ||
        data.context
      ) {
        const updatedChat = {
          ...chat,

          ...(data.title
            ? {
                title: data.title,
              }
            : {}),

          ...(data.context
            ? {
                context: data.context,
              }
            : {}),

          updatedAt:
            new Date().toISOString(),
        };

        setCurrentChat(
          updatedChat
        );

        setChats((previous) =>
          previous.map(
            (item) =>
              item.id === chat.id
                ? {
                    ...item,
                    ...updatedChat,
                  }
                : item
          )
        );
      }

      loadChats();
    } catch (error) {
      console.error(
        "Send message error:",
        error
      );

      setMessages((previous) =>
        previous.filter(
          (message) =>
            message.id !==
            temporaryUserMessage.id
        )
      );

      alert(error.message);
    } finally {
      setLoading(false);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };


  // ==========================================================
  // ENTER TO SEND
  // ==========================================================

  const handleInputKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      sendMessage();
    }
  };


  // ==========================================================
  // TRANSLATE
  // ==========================================================

  const translateMessage = async (
    message
  ) => {
    if (!message?.content) return;

    try {
      setTranslating(true);

      const response =
        await fetch(
          `${API}/api/translate`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials: "include",

            body: JSON.stringify({
              text: message.content,
              language:
                translationLanguage,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Translation failed"
        );
      }

      const translatedMessage = {
        id: `translation-${Date.now()}`,
        role: "assistant",
        content:
          `### Translation — ${translationLanguage}\n\n${data.translation}`,
      };

      setMessages((previous) => [
        ...previous,
        translatedMessage,
      ]);

      setTranslationOpen(false);
    } catch (error) {
      console.error(
        "Translation error:",
        error
      );

      alert(error.message);
    } finally {
      setTranslating(false);
    }
  };


  // ==========================================================
  // TRANSLATE LAST ASSISTANT MESSAGE
  // ==========================================================

  const translateLastMessage = () => {
    const lastAssistant =
      [...messages]
        .reverse()
        .find(
          (message) =>
            message.role ===
            "assistant"
        );

    if (!lastAssistant) {
      alert(
        "There is no AI response to translate yet."
      );

      return;
    }

    translateMessage(
      lastAssistant
    );
  };


  // ==========================================================
  // CODE CONVERSION
  // ==========================================================

  const convertCode = async (
    code,
    fromLanguage,
    toLanguage
  ) => {
    if (converting) return;

    try {
      setConverting(true);

      const response =
        await fetch(
          `${API}/api/convert-code`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials: "include",

            body: JSON.stringify({
              code,

              fromLanguage:
                fromLanguage ||
                "unknown",

              toLanguage,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Code conversion failed"
        );
      }

      setMessages((previous) => [
        ...previous,

        {
          id: `conversion-${Date.now()}`,
          role: "assistant",
          content:
            `### Converted to ${toLanguage}\n\n\`\`\`${toLanguage}\n${data.code}\n\`\`\``,
        },
      ]);
    } catch (error) {
      console.error(
        "Code conversion error:",
        error
      );

      alert(error.message);
    } finally {
      setConverting(false);
    }
  };


  // ==========================================================
  // LOGOUT
  // ==========================================================

  const logout = async () => {
    try {
      await fetch(
        `${API}/api/auth/logout`,
        {
          method: "POST",
          credentials: "include",
        }
      );
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );
    } finally {
      stopSpeaking();
      stopListening();

      setUser(null);

      setChats([]);
      setCurrentChat(null);
      setMessages([]);

      setInput("");
      setImages([]);
    }
  };


  // ==========================================================
  // COPY MESSAGE
  // ==========================================================

  const copyMessage = async (
    content
  ) => {
    try {
      await navigator.clipboard.writeText(
        content
      );
    } catch (error) {
      console.error(
        "Copy message failed:",
        error
      );
    }
  };


  // ==========================================================
  // CLEANUP
  // ==========================================================

  useEffect(() => {
    return () => {
      if (
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
      }

      recognitionRef.current?.stop();
    };
  }, []);


  // ==========================================================
  // AUTH LOADING
  // ==========================================================

  if (checkingAuth) {
    return (
      <div className="loading-screen">
        Loading...
      </div>
    );
  }


  // ==========================================================
  // LOGIN
  // ==========================================================

  if (!user) {
    return (
      <Login
        onLogin={(loggedInUser) => {
          setUser(loggedInUser);
        }}
      />
    );
  }


  // ==========================================================
  // MAIN UI
  // ==========================================================

  return (
    <div className="app">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`sidebar ${
          mobileSidebar
            ? "open"
            : ""
        }`}
      >

        <div className="sidebar-header">

          <div className="sidebar-brand">

            <div className="sidebar-brand-icon">
              AI
            </div>

            <div className="sidebar-brand-text">

              <span className="sidebar-brand-title">
                AI Assistant
              </span>

              <span className="sidebar-brand-subtitle">
                Conversations
              </span>

            </div>

          </div>

          <button
            className="new-chat-button"
            onClick={createChat}
            title="New conversation"
          >
            +
          </button>

        </div>


        {/* CHAT LIST */}

        <div className="chat-list">

          {loadingChats ? (

            <div className="empty-chats">
              Loading conversations...
            </div>

          ) : chats.length === 0 ? (

            <div className="empty-chats">
              No conversations yet.
              <br />
              Start a new conversation.
            </div>

          ) : (

            chats.map((chat) => (

              <div
                key={chat.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >

                <button
                  className={`chat-item ${
                    currentChat?.id ===
                    chat.id
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    loadChat(chat.id)
                  }
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >

                  <span className="chat-item-title">
                    {chat.title ||
                      "New conversation"}
                  </span>

                </button>

                <button
                  onClick={(event) =>
                    deleteChat(
                      chat.id,
                      event
                    )
                  }
                  title="Delete conversation"
                  style={{
                    width: "28px",
                    height: "30px",
                    flexShrink: 0,
                    border: "none",
                    borderRadius: "7px",
                    background:
                      "transparent",
                    color: "#666672",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background =
                      "#291b20";

                    event.currentTarget.style.color =
                      "#ff7c7c";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background =
                      "transparent";

                    event.currentTarget.style.color =
                      "#666672";
                  }}
                >
                  ×
                </button>

              </div>

            ))

          )}

        </div>


        {/* USER */}

        <div className="sidebar-user">

          <div className="sidebar-user-info">

            <div className="user-avatar">

              {(
                user?.name ||
                user?.username ||
                "U"
              )
                .charAt(0)
                .toUpperCase()}

            </div>

            <div className="sidebar-user-details">

              <span className="sidebar-user-name">
                {user?.name ||
                  user?.username}
              </span>

              <span className="sidebar-user-role">
                {user?.username ===
                "admin"
                  ? "Administrator"
                  : "User"}
              </span>

            </div>

          </div>

          <button
            className="logout-button"
            onClick={logout}
          >
            <span>↪</span>
            Logout
          </button>

        </div>

      </aside>


      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="main">

        {/* TOPBAR */}

        <header className="topbar">

          <div className="topbar-left">

            <button
              className="menu-button"
              onClick={() =>
                setMobileSidebar(
                  (previous) =>
                    !previous
                )
              }
              title="Menu"
            >
              ☰
            </button>

            <span className="conversation-title">
              {currentChat?.title ||
                "New conversation"}
            </span>

          </div>


          <div className="topbar-right">

            {/* VOICE */}

            <div
              style={{
                position: "relative",
              }}
            >

              <button
                className="topbar-action"
                onClick={() =>
                  setVoiceOpen(
                    (previous) =>
                      !previous
                  )
                }
              >
                🔊 Voice
              </button>

              {voiceOpen && (

                <div
                  style={{
                    position: "absolute",
                    top: "45px",
                    right: 0,
                    zIndex: 50,
                    width: "280px",
                    maxHeight: "350px",
                    overflowY: "auto",
                    padding: "8px",
                    border:
                      "1px solid #30303a",
                    borderRadius: "12px",
                    background:
                      "#18181f",
                    boxShadow:
                      "0 20px 50px rgba(0,0,0,.5)",
                  }}
                >

                  {voices.length === 0 ? (

                    <div
                      style={{
                        padding: "12px",
                        color:
                          "#777782",
                        fontSize: "12px",
                      }}
                    >
                      No voices available.
                    </div>

                  ) : (

                    voices.map((voice) => (

                      <div
                        key={`${voice.name}-${voice.lang}`}
                        style={{
                          display: "flex",
                          gap: "5px",
                          marginBottom: "3px",
                        }}
                      >

                        <button
                          onClick={() =>
                            chooseVoice(
                              voice
                            )
                          }
                          style={{
                            flex: 1,
                            minWidth: 0,
                            border: "none",
                            borderRadius:
                              "7px",
                            padding:
                              "9px 10px",
                            background:
                              selectedVoice?.name ===
                              voice.name
                                ? "#272d4a"
                                : "transparent",
                            color:
                              selectedVoice?.name ===
                              voice.name
                                ? "#aab5ff"
                                : "#ccc",
                            textAlign:
                              "left",
                            cursor:
                              "pointer",
                            fontSize:
                              "12px",
                            overflow:
                              "hidden",
                            textOverflow:
                              "ellipsis",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {voice.name}
                        </button>

                        <button
                          onClick={() =>
                            testVoice(
                              voice
                            )
                          }
                          title="Test voice"
                          style={{
                            width: "34px",
                            border: "none",
                            borderRadius:
                              "7px",
                            background:
                              "#22222b",
                            color:
                              "#aaa",
                            cursor:
                              "pointer",
                          }}
                        >
                          ▶
                        </button>

                      </div>

                    ))

                  )}

                </div>

              )}

            </div>


            {/* TRANSLATE */}

            <button
              className="topbar-action"
              onClick={() =>
                setTranslationOpen(
                  true
                )
              }
            >
              🌐 Translate
            </button>


            {/* READ / STOP */}

            {speaking && (

              <button
                className="topbar-action"
                onClick={stopSpeaking}
              >
                ⏹ Stop
              </button>

            )}


            {/* USER */}

            <div className="topbar-user">

              <div
                className="topbar-avatar"
                title={
                  user?.name ||
                  user?.username
                }
              >
                {(
                  user?.name ||
                  user?.username ||
                  "U"
                )
                  .charAt(0)
                  .toUpperCase()}
              </div>

            </div>

          </div>

        </header>


        {/* ===================================================
            MESSAGES
        =================================================== */}

        <div className="messages">

          {messages.length === 0 ? (

            <div className="welcome">

              <div className="welcome-icon">
                ✨
              </div>

              <h1>
                What can I help you with?
              </h1>

              <p>
                Start a new conversation
                and ask anything.
              </p>

              <button
                className="welcome-new-chat"
                onClick={createChat}
              >
                <span>+</span>
                New conversation
              </button>

            </div>

          ) : (

            messages.map(
              (message, index) => (

                <div
                  key={
                    message.id ||
                    index
                  }
                  className={`message-row ${
                    message.role
                  }`}
                >

                  <div
                    className={`message ${
                      message.role
                    }`}
                  >

                    {/* USER IMAGE PREVIEWS */}

                    {message.role ===
                      "user" &&
                      message.images?.length >
                        0 && (

                        <div
                          style={{
                            display:
                              "flex",
                            flexWrap:
                              "wrap",
                            gap: "7px",
                            marginBottom:
                              message.content
                                ? "10px"
                                : "0",
                          }}
                        >

                          {message.images.map(
                            (
                              image,
                              imageIndex
                            ) => (

                              <img
                                key={
                                  imageIndex
                                }
                                src={image}
                                alt="Uploaded"
                                style={{
                                  width:
                                    "150px",
                                  maxHeight:
                                    "150px",
                                  objectFit:
                                    "cover",
                                  borderRadius:
                                    "9px",
                                }}
                              />

                            )
                          )}

                        </div>

                      )}


                    {/* MESSAGE CONTENT */}

                    {message.content && (

                      <MarkdownMessage
                        content={
                          message.content
                        }
                        onConvert={
                          convertCode
                        }
                      />

                    )}


                    {/* MESSAGE ACTIONS */}

                    {message.role ===
                      "assistant" && (

                      <div
                        style={{
                          display:
                            "flex",
                          gap: "6px",
                          marginTop:
                            "12px",
                        }}
                      >

                        <button
                          className="code-action"
                          onClick={() =>
                            copyMessage(
                              message.content
                            )
                          }
                        >
                          Copy
                        </button>

                        <button
                          className="code-action"
                          onClick={() =>
                            readAloud(
                              message.content
                            )
                          }
                        >
                          🔊 Read
                        </button>

                        <button
                          className="code-action"
                          onClick={() =>
                            translateMessage(
                              message
                            )
                          }
                        >
                          🌐 Translate
                        </button>

                      </div>

                    )}

                  </div>

                </div>

              )
            )

          )}


          {/* AI LOADING */}

          {loading && (

            <div className="message-row assistant">

              <div className="message assistant">

                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: "6px",
                    color:
                      "#777782",
                  }}
                >
                  <span>
                    AI is thinking
                  </span>

                  <span>
                    •••
                  </span>
                </div>

              </div>

            </div>

          )}


          {/* CODE CONVERSION */}

          {converting && (

            <div
              style={{
                position:
                  "fixed",
                bottom:
                  "115px",
                left: "50%",
                transform:
                  "translateX(-50%)",
                zIndex: 50,
                padding:
                  "8px 14px",
                border:
                  "1px solid #30303a",
                borderRadius:
                  "9px",
                background:
                  "#18181f",
                color:
                  "#aaa",
                fontSize:
                  "12px",
              }}
            >
              Converting code...
            </div>

          )}

          <div
            ref={messagesEndRef}
          />

        </div>


        {/* ===================================================
            INPUT AREA
        =================================================== */}

        <div className="input-area">

          {/* IMAGE PREVIEWS */}

          {images.length > 0 && (

            <div className="image-preview-container">

              {images.map(
                (image, index) => (

                  <div
                    className="image-preview"
                    key={`${image.name}-${index}`}
                  >

                    <img
                      src={image.preview}
                      alt="Preview"
                    />

                    <button
                      className="image-preview-remove"
                      onClick={() =>
                        removeImage(
                          index
                        )
                      }
                    >
                      ×
                    </button>

                  </div>

                )
              )}

            </div>

          )}


          <div className="input-container">

            {/* ATTACH IMAGE */}

            <button
              className="input-button"
              onClick={() =>
                fileRef.current?.click()
              }
              title="Attach image"
            >
              📎
            </button>


            {/* FILE INPUT */}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={
                handleFileChange
              }
            />


            {/* TEXT INPUT */}

            <textarea
              ref={inputRef}
              className="message-input"
              value={input}
              onChange={(event) =>
                setInput(
                  event.target.value
                )
              }
              onKeyDown={
                handleInputKeyDown
              }
              placeholder="Message AI..."
              rows={1}
            />


            {/* VOICE INPUT */}

            <button
              className={`input-button ${
                listening
                  ? "active"
                  : ""
              }`}
              onClick={
                listening
                  ? stopListening
                  : startListening
              }
              title={
                listening
                  ? "Stop listening"
                  : "Voice input"
              }
            >
              🎙
            </button>


            {/* SEND */}

            <button
              className="send-button"
              onClick={sendMessage}
              disabled={
                loading ||
                (
                  !input.trim() &&
                  images.length === 0
                )
              }
              title="Send message"
            >
              ↑
            </button>

          </div>

        </div>

      </main>


      {/* =====================================================
          TRANSLATION MODAL
      ===================================================== */}

      {translationOpen && (

        <div
          style={{
            position:
              "fixed",
            inset: 0,
            zIndex: 200,
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding: "20px",
            background:
              "rgba(0,0,0,.65)",
          }}
          onClick={() =>
            setTranslationOpen(
              false
            )
          }
        >

          <div
            style={{
              width: "100%",
              maxWidth: "390px",
              padding: "22px",
              border:
                "1px solid #30303a",
              borderRadius:
                "15px",
              background:
                "#17171e",
              boxShadow:
                "0 25px 70px rgba(0,0,0,.5)",
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <h3
              style={{
                margin:
                  "0 0 7px",
                color:
                  "#eee",
                fontSize:
                  "18px",
              }}
            >
              Translate
            </h3>

            <p
              style={{
                margin:
                  "0 0 18px",
                color:
                  "#777782",
                fontSize:
                  "13px",
              }}
            >
              Choose a language for the
              latest AI response.
            </p>


            <select
              value={
                translationLanguage
              }
              onChange={(event) =>
                setTranslationLanguage(
                  event.target.value
                )
              }
              style={{
                width: "100%",
                padding:
                  "11px 12px",
                border:
                  "1px solid #33333d",
                borderRadius:
                  "8px",
                background:
                  "#101014",
                color:
                  "#eee",
                outline:
                  "none",
              }}
            >

              {TRANSLATION_LANGUAGES.map(
                (language) => (

                  <option
                    key={language}
                    value={language}
                  >
                    {language}
                  </option>

                )
              )}

            </select>


            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "flex-end",
                gap: "8px",
                marginTop:
                  "18px",
              }}
            >

              <button
                onClick={() =>
                  setTranslationOpen(
                    false
                  )
                }
                style={{
                  padding:
                    "9px 13px",
                  border:
                    "1px solid #30303a",
                  borderRadius:
                    "8px",
                  background:
                    "#202028",
                  color:
                    "#bbb",
                  cursor:
                    "pointer",
                }}
              >
                Cancel
              </button>


              <button
                onClick={
                  translateLastMessage
                }
                disabled={
                  translating
                }
                style={{
                  padding:
                    "9px 14px",
                  border:
                    "none",
                  borderRadius:
                    "8px",
                  background:
                    "#667cff",
                  color:
                    "#fff",
                  cursor:
                    "pointer",
                  opacity:
                    translating
                      ? 0.6
                      : 1,
                }}
              >
                {translating
                  ? "Translating..."
                  : "Translate"}
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;