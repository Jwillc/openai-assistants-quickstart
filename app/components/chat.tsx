"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./chat.module.css";
import Markdown from "react-markdown";

type MessageProps = {
  role: "user" | "assistant";
  text: string;
  imageUrl?: string;
};

const UserMessage = ({ text, imageUrl }: { text: string; imageUrl?: string }) => {
  return (
    <div className={styles.userMessage}>
      {imageUrl && (
        <img 
          src={imageUrl} 
          alt="Uploaded content" 
          className={styles.uploadedImage}
          style={{ maxWidth: '200px', marginBottom: '8px' }} 
        />
      )}
      {text}
    </div>
  );
};

const AssistantMessage = ({ text }: { text: string }) => {
  return (
    <div className={styles.assistantMessage}>
      <Markdown>{text}</Markdown>
    </div>
  );
};

const Message = ({ role, text, imageUrl }: MessageProps) => {
  switch (role) {
    case "user":
      return <UserMessage text={text} imageUrl={imageUrl} />;
    case "assistant":
      return <AssistantMessage text={text} />;
    default:
      return null;
  }
};

const Chat = () => {
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [error, setError] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (20MB limit)
      if (file.size > 20 * 1024 * 1024) {
        setError("Image size must be less than 20MB");
        return;
      }

      // Check file type
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        setError("Only JPEG, PNG, WEBP, and non-animated GIF files are supported");
        return;
      }

      setSelectedImage(file);
      setError("");

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() && !selectedImage) return;

    setIsLoading(true);
    setError("");

    try {
      if (selectedImage) {
        const reader = new FileReader();
        reader.readAsDataURL(selectedImage);
        
        reader.onloadend = async () => {
          const base64Image = reader.result?.toString().split(',')[1]; // Remove data:image/jpeg;base64, prefix
          
          if (!base64Image) {
            throw new Error("Failed to process image");
          }

          // Add message with image preview
          setMessages(prev => [...prev, {
            role: "user",
            text: userInput || "What is in this image?",
            imageUrl: imagePreview
          }]);

          const response = await fetch('/api/assistants/vision', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageBase64: base64Image,
              question: userInput || "What is in this image?"
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to analyze image');
          }

          const data = await response.json();
          
          setMessages(prev => [...prev, {
            role: "assistant",
            text: data.result
          }]);

          // Clear image and preview
          setSelectedImage(null);
          setImagePreview("");
        };

        reader.onerror = () => {
          throw new Error("Failed to read image file");
        };
      }

      if (userInput.trim()) {
        setMessages(prev => [...prev, {
          role: "user",
          text: userInput
        }]);
      }

      setUserInput("");
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.messages}>
        {messages.map((msg, index) => (
          <Message key={index} {...msg} />
        ))}
        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form
        onSubmit={handleSubmit}
        className={`${styles.inputForm} ${styles.clearfix}`}
      >
        <input
          type="text"
          className={styles.input}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Enter your question"
          disabled={isLoading}
        />
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleImageSelect}
          disabled={isLoading}
        />
        {imagePreview && (
          <div className={styles.imagePreview}>
            <img 
              src={imagePreview} 
              alt="Preview" 
              style={{ maxWidth: '100px', marginTop: '8px' }} 
            />
            <button 
              type="button" 
              onClick={() => {
                setSelectedImage(null);
                setImagePreview("");
              }}
            >
              Clear
            </button>
          </div>
        )}
        <button
          type="submit"
          className={styles.button}
          disabled={isLoading || (!userInput.trim() && !selectedImage)}
        >
          {isLoading ? 'Processing...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default Chat;