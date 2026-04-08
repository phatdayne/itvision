import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  db, 
  onAuthStateChanged, 
  signInWithPopup, 
  googleProvider, 
  signOut, 
  FirebaseUser,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  OperationType,
  handleFirestoreError,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from '../firebase';

interface FirebaseContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  isAuthorized: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Fallback timeout: if Firebase doesn't respond in 8 seconds, stop loading
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("Firebase Auth timed out. Setting loading to false.");
        setLoading(false);
      }
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          const isDefaultAdmin = user.email === 'whoiamppt@gmail.com';
          const userEmail = user.email!.toLowerCase();
          
          try {
            // 1. Check for UID-based document (already activated)
            const uidRef = doc(db, 'users', user.uid);
            const uidSnap = await getDoc(uidRef);
            
            if (uidSnap.exists()) {
              const userData = uidSnap.data();
              setIsAdmin(userData.role === 'admin');
              setIsAuthorized(true);
              
              // Update profile info if changed
              if (userData.displayName !== user.displayName || userData.photoURL !== user.photoURL) {
                await setDoc(uidRef, {
                  displayName: user.displayName || userData.displayName,
                  photoURL: user.photoURL || userData.photoURL,
                }, { merge: true });
              }
            } else {
              // 2. Check for Email-based document (whitelisted but not activated)
              const emailRef = doc(db, 'users', userEmail);
              const emailSnap = await getDoc(emailRef);
              
              if (emailSnap.exists()) {
                const whitelistData = emailSnap.data();
                
                // Activate: Create UID-based doc
                await setDoc(uidRef, {
                  uid: user.uid,
                  email: user.email,
                  displayName: user.displayName,
                  photoURL: user.photoURL,
                  role: whitelistData.role,
                  createdAt: whitelistData.createdAt || new Date().toISOString()
                });
                
                // Delete the email-based whitelist doc now that it's activated
                try {
                  await deleteDoc(emailRef);
                } catch (deleteError) {
                  console.error("Error deleting whitelist doc:", deleteError);
                }
                
                setIsAdmin(whitelistData.role === 'admin');
                setIsAuthorized(true);
              } else if (isDefaultAdmin) {
                // 3. Auto-create for default admin if not even whitelisted
                await setDoc(uidRef, {
                  uid: user.uid,
                  email: user.email,
                  displayName: user.displayName,
                  photoURL: user.photoURL,
                  role: 'admin',
                  createdAt: new Date().toISOString()
                });
                setIsAdmin(true);
                setIsAuthorized(true);
              } else {
                setIsAdmin(false);
                setIsAuthorized(false);
              }
            }
          } catch (error) {
            console.error("Auth Check Error:", error);
            if (isDefaultAdmin) {
              setIsAdmin(true);
              setIsAuthorized(true);
            } else {
              setIsAuthorized(false);
            }
          }
        } else {
          setIsAdmin(false);
          setIsAuthorized(false);
        }
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error("Email Login Error:", error);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const user = userCredential.user;
      
      // Create initial user document
      const uidRef = doc(db, 'users', user.uid);
      await setDoc(uidRef, {
        uid: user.uid,
        email: user.email,
        displayName: name,
        photoURL: null,
        role: 'user', // Default role
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Registration Error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return (
    <FirebaseContext.Provider value={{ user, loading, isAdmin, isAuthorized, login, loginWithEmail, registerWithEmail, logout }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
