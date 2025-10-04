import { useState, useEffect, useRef, useCallback } from 'react';

const useInactivityTimeout = (timeoutMinutes = 5, onTimeout) => {
  const [isActive, setIsActive] = useState(true);
  const timeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    lastActivityRef.current = Date.now();
    setIsActive(true);

    timeoutRef.current = setTimeout(() => {
      setIsActive(false);
      onTimeout();
    }, timeoutMinutes * 60 * 1000); // Convert minutes to milliseconds
  }, [timeoutMinutes, onTimeout]);

  const handleActivity = useCallback(() => {
    resetTimeout();
  }, [resetTimeout]);

  useEffect(() => {
    // Set up event listeners for user activity
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Initialize the timeout
    resetTimeout();

    // Cleanup function
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [timeoutMinutes, onTimeout, handleActivity, resetTimeout]);

  return { isActive, resetTimeout };
};

export default useInactivityTimeout;
