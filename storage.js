(function (global) {
  const DB_NAME = "gptPlantWalksDb";
  const DB_VERSION = 2;
  const STORES = {
    walks: "walks",
    issues: "issues",
    photos: "photos",
    drafts: "drafts",
    syncEvents: "syncEvents"
  };

  let dbPromise = null;

  function createId(prefix) {
    const randomSuffix = global.crypto && typeof global.crypto.randomUUID === "function"
      ? global.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}-${randomSuffix}`;
  }

  function promiseFromRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function getAllFromStore(store) {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function clearStore(store) {
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  function transactionPromise(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
    });
  }

  function openDatabase() {
    if (dbPromise) {
      return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
      const request = global.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = event => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORES.walks)) {
          db.createObjectStore(STORES.walks, { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(STORES.issues)) {
          db.createObjectStore(STORES.issues, { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(STORES.photos)) {
          db.createObjectStore(STORES.photos, { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(STORES.drafts)) {
          db.createObjectStore(STORES.drafts, { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(STORES.syncEvents)) {
          db.createObjectStore(STORES.syncEvents, { keyPath: "eventId" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  async function migrateLegacyData() {
    const db = await openDatabase();
    const walkStore = db.transaction(STORES.walks, "readonly").objectStore(STORES.walks);
    const issueStore = db.transaction(STORES.issues, "readonly").objectStore(STORES.issues);
    const photoStore = db.transaction(STORES.photos, "readonly").objectStore(STORES.photos);
    const draftStore = db.transaction(STORES.drafts, "readonly").objectStore(STORES.drafts);

    const [walkCount, issueCount, photoCount, draftCount] = await Promise.all([
      getAllFromStore(walkStore).then(items => items.length),
      getAllFromStore(issueStore).then(items => items.length),
      getAllFromStore(photoStore).then(items => items.length),
      getAllFromStore(draftStore).then(items => items.length)
    ]);

    if (walkCount > 0 || issueCount > 0 || photoCount > 0 || draftCount > 0) {
      return;
    }

    let legacyWalks = [];
    try {
      legacyWalks = JSON.parse(global.localStorage.getItem("gptPlantWalks") || "[]");
    } catch (error) {
      console.error("Could not parse legacy walk data.", error);
    }

    if (Array.isArray(legacyWalks) && legacyWalks.length > 0) {
      await saveWalks(legacyWalks);
    }

    const legacyDraft = global.localStorage.getItem("gptPlantWalkDraft");
    if (legacyDraft) {
      try {
        const parsedDraft = JSON.parse(legacyDraft);
        if (parsedDraft && typeof parsedDraft === "object" && parsedDraft.walkId) {
          await saveDraft(parsedDraft);
        }
      } catch (error) {
        console.error("Could not parse legacy draft data.", error);
      }
    }

    global.localStorage.removeItem("gptPlantWalks");
    global.localStorage.removeItem("gptPlantWalkDraft");
  }

  async function initializeStorage() {
    await openDatabase();
    await migrateLegacyData();

    const walks = await loadWalks();
    const activeWalkId = global.localStorage.getItem("gptPlantWalkActiveWalkId") || "";
    const draft = await loadDraft(activeWalkId || null);

    return { walks, activeWalkId, draft };
  }

  async function saveWalks(walks) {
    const db = await openDatabase();
    const transaction = db.transaction([STORES.walks, STORES.issues, STORES.photos], "readwrite");
    const walkStore = transaction.objectStore(STORES.walks);
    const issueStore = transaction.objectStore(STORES.issues);
    const photoStore = transaction.objectStore(STORES.photos);

    await clearStore(walkStore);
    await clearStore(issueStore);
    await clearStore(photoStore);

    const walkRecords = [];

    walks.forEach(walk => {
      const issueIds = [];
      const issues = Array.isArray(walk.issues) ? walk.issues : [];

      issues.forEach(issue => {
        const photoIds = [];
        const photos = Array.isArray(issue.photos) ? issue.photos : [];

        photos.forEach(photo => {
          const photoId = createId("photo");
          photoStore.put({ id: photoId, walkId: walk.id, issueId: issue.id, dataUrl: photo });
          photoIds.push(photoId);
        });

        issueStore.put({
          id: issue.id,
          walkId: walk.id,
          time: issue.time,
          observedAt: issue.observedAt,
          observation: issue.observation,
          workOrderId: issue.workOrderId,
          initialPriority: issue.initialPriority || "Planned",
          syncStatus: issue.syncStatus || "not_queued",
          syncEventId: issue.syncEventId || null,
          plannerAcceptedAt: issue.plannerAcceptedAt || null,
          lastSyncAttemptAt: issue.lastSyncAttemptAt || null,
          syncError: issue.syncError || null,
          photoIds
        });
        issueIds.push(issue.id);
      });

      walkRecords.push({
        id: walk.id,
        version: walk.version,
        status: walk.status,
        startedAt: walk.startedAt,
        endedAt: walk.endedAt,
        completedAt: walk.completedAt,
        issueIds
      });
    });

    walkRecords.forEach(record => walkStore.put(record));
    await transactionPromise(transaction);
  }

  async function loadWalks() {
    const db = await openDatabase();
    const transaction = db.transaction([STORES.walks, STORES.issues, STORES.photos], "readonly");
    const walkStore = transaction.objectStore(STORES.walks);
    const issueStore = transaction.objectStore(STORES.issues);
    const photoStore = transaction.objectStore(STORES.photos);

    const [walkRecords, issueRecords, photoRecords] = await Promise.all([
      getAllFromStore(walkStore),
      getAllFromStore(issueStore),
      getAllFromStore(photoStore)
    ]);

    const photoMap = new Map(photoRecords.map(photo => [photo.id, photo]));
    const issuesByWalk = new Map();

    issueRecords.forEach(issue => {
      if (!issuesByWalk.has(issue.walkId)) {
        issuesByWalk.set(issue.walkId, []);
      }
      issuesByWalk.get(issue.walkId).push(issue);
    });

    return walkRecords.map(walkRecord => {
      const issues = (issuesByWalk.get(walkRecord.id) || []).map(issue => ({
        id: issue.id,
        walkId: issue.walkId,
        time: issue.time,
        observedAt: issue.observedAt,
        observation: issue.observation,
        workOrderId: issue.workOrderId,
        initialPriority: issue.initialPriority || "Planned",
        syncStatus: issue.syncStatus || "not_queued",
        syncEventId: issue.syncEventId || null,
        plannerAcceptedAt: issue.plannerAcceptedAt || null,
        lastSyncAttemptAt: issue.lastSyncAttemptAt || null,
        syncError: issue.syncError || null,
        photos: (issue.photoIds || [])
          .map(photoId => photoMap.get(photoId))
          .filter(Boolean)
          .map(photo => photo.dataUrl)
      }));

      return {
        id: walkRecord.id,
        version: walkRecord.version,
        status: walkRecord.status,
        startedAt: walkRecord.startedAt,
        endedAt: walkRecord.endedAt,
        completedAt: walkRecord.completedAt,
        issues
      };
    });
  }

  async function saveDraft(draft) {
    if (!draft || !draft.walkId) {
      return;
    }

    const db = await openDatabase();
    const transaction = db.transaction([STORES.drafts, STORES.photos], "readwrite");
    const draftStore = transaction.objectStore(STORES.drafts);
    const photoStore = transaction.objectStore(STORES.photos);

    const photoIds = [];
    const photos = Array.isArray(draft.photos) ? draft.photos : [];

    photos.forEach(photo => {
      const photoId = createId("photo");
      photoStore.put({ id: photoId, walkId: draft.walkId, issueId: null, dataUrl: photo });
      photoIds.push(photoId);
    });

    draftStore.put({
      id: draft.walkId,
      walkId: draft.walkId,
      observation: draft.observation || "",
      photoIds,
      updatedAt: draft.updatedAt || new Date().toISOString()
    });

    await transactionPromise(transaction);
  }

  async function loadDraft(walkId) {
    if (!walkId) {
      return null;
    }

    const db = await openDatabase();
    const transaction = db.transaction([STORES.drafts, STORES.photos], "readonly");
    const draftStore = transaction.objectStore(STORES.drafts);
    const photoStore = transaction.objectStore(STORES.photos);

    const [draftRecord, photoRecords] = await Promise.all([
      promiseFromRequest(draftStore.get(walkId)),
      getAllFromStore(photoStore)
    ]);

    if (!draftRecord) {
      return null;
    }

    const photoMap = new Map(photoRecords.map(photo => [photo.id, photo]));

    return {
      walkId: draftRecord.walkId,
      observation: draftRecord.observation || "",
      photos: (draftRecord.photoIds || [])
        .map(photoId => photoMap.get(photoId))
        .filter(Boolean)
        .map(photo => photo.dataUrl)
    };
  }

  async function clearDraft(walkId) {
    if (!walkId) {
      return;
    }

    const db = await openDatabase();
    const transaction = db.transaction([STORES.drafts], "readwrite");
    const draftStore = transaction.objectStore(STORES.drafts);
    draftStore.delete(walkId);
    await transactionPromise(transaction);
  }

  async function putSyncEvent(event) {
    if (!event || !event.eventId) throw new TypeError("Sync event id is required.");
    const db = await openDatabase();
    const transaction = db.transaction(STORES.syncEvents, "readwrite");
    transaction.objectStore(STORES.syncEvents).put(event);
    await transactionPromise(transaction);
    return event;
  }

  async function loadSyncEvents() {
    const db = await openDatabase();
    const transaction = db.transaction(STORES.syncEvents, "readonly");
    return getAllFromStore(transaction.objectStore(STORES.syncEvents));
  }

  async function getSyncEvent(eventId) {
    if (!eventId) return null;
    const db = await openDatabase();
    const transaction = db.transaction(STORES.syncEvents, "readonly");
    return promiseFromRequest(transaction.objectStore(STORES.syncEvents).get(eventId));
  }

  async function deleteSyncEventsForWalk(walkId) {
    if (!walkId) return;
    const db = await openDatabase();
    const transaction = db.transaction(STORES.syncEvents, "readwrite");
    const store = transaction.objectStore(STORES.syncEvents);
    const events = await getAllFromStore(store);
    events.filter(event => event.walkId === walkId).forEach(event => store.delete(event.eventId));
    await transactionPromise(transaction);
  }

  global.appStorage = {
    initializeStorage,
    saveWalks,
    loadWalks,
    saveDraft,
    loadDraft,
    clearDraft,
    putSyncEvent,
    loadSyncEvents,
    getSyncEvent,
    deleteSyncEventsForWalk,
    openDatabase
  };
})(window);
