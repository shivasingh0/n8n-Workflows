"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Send, Mic, Volume2, VolumeX, AlertCircle, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import type SpeechRecognition from "speech-recognition"

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
  isVoiceInput?: boolean
}

export default function VoiceChatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Hello! I'm your AI assistant. You can type messages or click the microphone to speak. I'll convert your speech to text and respond with both text and voice.",
      isUser: false,
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [textToSpeechEnabled, setTextToSpeechEnabled] = useState(true)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const isRecognitionActiveRef = useRef(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    console.log(`[v0] Voice chatbot initialized with sessionId: ${sessionId}`)

    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

      if (!SpeechRecognition) {
        setSpeechSupported(false)
        setError("Speech recognition not supported in this browser")
      } else {
        setSpeechSupported(true)
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = false
        recognition.lang = "en-US"
        recognitionRef.current = recognition
      }

      if ("speechSynthesis" in window) {
        synthRef.current = window.speechSynthesis
      }
    }
  }, [sessionId])

  const sendMessage = useCallback(
    async (message: string, isVoiceInput = false) => {
      if (!message.trim()) return

      const userMessage: Message = {
        id: Date.now().toString(),
        content: message,
        isUser: true,
        timestamp: new Date(),
        isVoiceInput,
      }

      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)

      try {
        const response = await fetch("https://shivaxrajawat.app.n8n.cloud/webhook/audio-agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: message,
            sessionId: sessionId,
          }),
        })

        const result = await response.json()
        const aiResponse = result.response || result.output || "I received your message!"

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: aiResponse,
          isUser: false,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, aiMessage])

        if (textToSpeechEnabled) {
          speakText(aiResponse)
        }
      } catch (error) {
        console.error("Error sending message:", error)
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: "Sorry, I had trouble processing your message. Please try again.",
          isUser: false,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      } finally {
        setIsLoading(false)
      }
    },
    [textToSpeechEnabled, sessionId],
  )

  const startListening = useCallback(async () => {
    if (!speechSupported || !recognitionRef.current || isRecognitionActiveRef.current) return

    try {
      setError(null)
      setIsListening(true)
      isRecognitionActiveRef.current = true

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        console.log("[v0] Speech recognized:", transcript)
        sendMessage(transcript, true)
      }

      recognitionRef.current.onerror = (event) => {
        console.error("[v0] Speech recognition error:", event.error)
        setError(`Speech recognition error: ${event.error}`)
        setIsListening(false)
        isRecognitionActiveRef.current = false
      }

      recognitionRef.current.onend = () => {
        console.log("[v0] Speech recognition ended")
        setIsListening(false)
        isRecognitionActiveRef.current = false
      }

      recognitionRef.current.start()
    } catch (error) {
      console.error("Error starting speech recognition:", error)
      setError("Failed to start speech recognition. Please try again.")
      setIsListening(false)
      isRecognitionActiveRef.current = false
    }
  }, [speechSupported, sendMessage])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isRecognitionActiveRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      isRecognitionActiveRef.current = false
    }
  }, [])

  const speakText = useCallback(
    (text: string) => {
      if (!synthRef.current || !textToSpeechEnabled) return

      synthRef.current.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      utterance.pitch = 1
      utterance.volume = 0.8

      utterance.onstart = () => {
        setIsSpeaking(true)
      }

      utterance.onend = () => {
        setIsSpeaking(false)
      }

      utterance.onerror = () => {
        setIsSpeaking(false)
      }

      synthRef.current.speak(utterance)
    },
    [textToSpeechEnabled],
  )

  const sendTextMessage = async () => {
    if (!inputValue.trim()) return
    await sendMessage(inputValue)
    setInputValue("")
  }

  const toggleListening = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl border-0 bg-card/50 backdrop-blur-sm relative">
        {isListening && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white/90 dark:bg-gray-900/90 rounded-3xl p-8 shadow-2xl border border-red-200 dark:border-red-800">
              <div className="text-center">
                <div className="relative mb-4">
                  <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                    <Mic className="w-12 h-12 text-white" />
                  </div>
                  {/* Ripple effect */}
                  <div className="absolute inset-0 w-24 h-24 bg-red-500/30 rounded-full animate-ping"></div>
                  <div
                    className="absolute inset-0 w-24 h-24 bg-red-500/20 rounded-full animate-ping"
                    style={{ animationDelay: "0.5s" }}
                  ></div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Listening...</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Speak now, I'm listening to you</p>
                <Button onClick={stopListening} className="bg-red-500 hover:bg-red-600 text-white">
                  <Square className="w-4 h-4 mr-2" />
                  Stop Listening
                </Button>
              </div>
            </div>
          </div>
        )}

        {isSpeaking && (
          <div className="absolute inset-0 bg-black/10 backdrop-blur-sm z-40 flex items-center justify-center">
            <div className="bg-white/90 dark:bg-gray-900/90 rounded-3xl p-8 shadow-2xl border border-blue-200 dark:border-blue-800">
              <div className="text-center">
                <div className="relative mb-4 flex items-center justify-center gap-1">
                  {/* Sound wave bars */}
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-2 bg-blue-500 rounded-full animate-pulse"
                      style={{
                        height: `${20 + Math.sin(Date.now() / 200 + i) * 10}px`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: "0.6s",
                      }}
                    ></div>
                  ))}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Speaking...</h3>
                <p className="text-gray-600 dark:text-gray-400">I'm responding to you</p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="p-6 border-b border-border/50 bg-white/80 dark:bg-gray-900/80">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-3 h-3 rounded-full transition-all duration-300",
                isListening ? "bg-red-500 animate-pulse" : isSpeaking ? "bg-blue-500 animate-pulse" : "bg-primary",
              )}
            ></div>
            <h1 className="text-2xl font-bold text-black dark:text-white">AI Voice Assistant</h1>
            <div className="ml-auto flex items-center gap-4">
              <div className="text-sm text-slate-700 dark:text-slate-300">
                {error && (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs">{error}</span>
                  </div>
                )}
                {!error && isLoading && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-primary rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-primary rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <span>Processing...</span>
                  </div>
                )}
              </div>
              <Button
                onClick={() => setTextToSpeechEnabled(!textToSpeechEnabled)}
                variant="outline"
                size="sm"
                className={cn(
                  "transition-all duration-200",
                  textToSpeechEnabled ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20",
                )}
              >
                {textToSpeechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                TTS
              </Button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 animate-in slide-in-from-bottom-2 duration-300",
                message.isUser ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[70%] rounded-2xl px-4 py-3 shadow-sm",
                  message.isUser
                    ? "bg-primary text-primary-foreground ml-12"
                    : "bg-card text-card-foreground mr-12 border border-border/50",
                )}
              >
                <div className="flex items-center gap-2">
                  {message.isVoiceInput && (
                    <div className="flex items-center gap-1">
                      <Mic className="w-3 h-3 text-green-500 animate-pulse" />
                      <div className="w-1 h-1 bg-green-500 rounded-full animate-ping"></div>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed">{message.content}</p>
                </div>
                <div className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-border/50 bg-muted/20">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your message or click microphone to speak..."
                className="resize-none border-border/50 bg-background/50 backdrop-blur-sm"
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    sendTextMessage()
                  }
                }}
                disabled={isLoading || isListening}
              />
            </div>

            <Button
              onClick={sendTextMessage}
              disabled={!inputValue.trim() || isLoading || isListening}
              className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Send className="w-4 h-4" />
            </Button>

            <Button
              onClick={toggleListening}
              disabled={!speechSupported || isLoading}
              className={cn(
                "shrink-0 transition-all duration-200 relative",
                isListening ? "bg-red-500 hover:bg-red-600 text-white" : "bg-green-500 hover:bg-green-600 text-white",
                !speechSupported && "opacity-50 cursor-not-allowed",
              )}
            >
              {isListening ? (
                <>
                  <Square className="w-4 h-4" />
                  <div className="absolute inset-0 bg-red-400/30 rounded animate-ping"></div>
                </>
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground mt-2 text-center">
            {!speechSupported
              ? "Speech recognition not supported - Use text input only"
              : isListening
                ? "🎤 Listening... Speak now, then click stop"
                : "Click microphone to speak or type your message"}
          </div>
        </div>
      </Card>
    </div>
  )
}
