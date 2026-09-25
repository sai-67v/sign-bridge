import { signOut } from "../libs/firebase";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../libs/firebase";
import { setSecretKeyToCache } from "../services/encryption";
import { isAppwriteAuthEnabled, logout } from "../libs/appwriteAuth";
import { setAppwriteUserId } from "../services/appwriteApi";
import {
  clearPadScopedStorageForUser,
  getPadPersistenceUid,
} from "../services/padClientStorage";
import { bootstrapPadClientPersistence } from "../services/padClientPersistence";

function Signout() {
  const navigate = useNavigate();

  useEffect(() => {
    setSecretKeyToCache("");

    if (isAppwriteAuthEnabled()) {
      const uid = getPadPersistenceUid();
      clearPadScopedStorageForUser(uid);
      bootstrapPadClientPersistence(null);
      setAppwriteUserId(null);
      logout()
        .then(() => navigate("/signin"))
        .catch(() => navigate("/signin"));
      return;
    }

    if (!auth) {
      const uid = getPadPersistenceUid();
      clearPadScopedStorageForUser(uid);
      bootstrapPadClientPersistence(null);
      localStorage.removeItem("demoUser");
      navigate("/signin");
      return;
    }

    const uid = getPadPersistenceUid();
    clearPadScopedStorageForUser(uid);
    bootstrapPadClientPersistence(null);
    signOut(auth).then(
      () => navigate("/signin"),
      () => navigate("/signin")
    );
  }, [navigate]);

  return <></>;
}

export default Signout;
