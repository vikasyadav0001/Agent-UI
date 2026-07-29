"use client";

import { useEffect } from "react";
import { useThread } from "@assistant-ui/react";

export function OAuthHandler() {
  const thread = useThread();

  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth") === "success") {
      const interruptId = sessionStorage.getItem("pending_interrupt_id");
      
      if (interruptId) {
        // Flag for the adapter
        sessionStorage.setItem("do_resume", interruptId);
        sessionStorage.removeItem("pending_interrupt_id");
        
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
        
        // Trigger a hidden message that our adapter will intercept
        thread.append({ 
          role: "user", 
          content: [{ type: "text", text: "[System: Resume Auth]" }] 
        });
      }
    }
  }, [thread]);

  return null;
}
