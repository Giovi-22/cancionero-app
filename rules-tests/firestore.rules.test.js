const {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails,
} = require("@firebase/rules-unit-testing");

const fs = require("fs");
const path = require("path");

let testEnv;

const PROJECT_ID = "cancionero-app-505214";
const FIRESTORE_HOST = "127.0.0.1";
const FIRESTORE_PORT = 8080;

const RULES = fs.readFileSync(
    path.join(__dirname, "..", "firestore.rules"),
    "utf8"
);

// ============================================================================
// HELPERS
// ============================================================================

function authenticatedUser(uid, email) {
    return testEnv.authenticatedContext(uid, {
        email,
    });
}

function unauthenticatedDb() {
    return testEnv.unauthenticatedContext().firestore();
}

// Crea una banda + su owner inicial en una única operación atómica.
async function createBandWithOwner({
    uid = "owner-1",
    email = "owner@test.com",
    bandId = "band-1",
} = {}) {
    const user = authenticatedUser(uid, email);
    const db = user.firestore();

    const batch = db.batch();

    const bandRef = db.collection("bands").doc(bandId);
    const memberRef = bandRef.collection("members").doc(uid);

    batch.set(bandRef, {
        name: "Banda Test",
        ownerId: uid,
        createdAt: new Date(),
    });

    batch.set(memberRef, {
        role: "owner",
        email,
        displayName: "Owner Test",
    });

    await batch.commit();
}

// ============================================================================
// SETUP
// ============================================================================

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,

        firestore: {
            host: FIRESTORE_HOST,
            port: FIRESTORE_PORT,
            rules: RULES,
        },
    });
});

afterAll(async () => {
    if (testEnv) {
        await testEnv.cleanup();
    }
});

beforeEach(async () => {
    await testEnv.clearFirestore();
});

// ============================================================================
// USERS
// ============================================================================

describe("USERS - Perfiles", () => {
    test("usuario autenticado puede crear su propio perfil", async () => {
        const user = authenticatedUser("user-1", "user1@test.com");
        const db = user.firestore();

        await assertSucceeds(
            db.collection("users").doc("user-1").set({
                uid: "user-1",
                email: "user1@test.com",
                displayName: "User 1",
                photoURL: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
        );
    });

    test("usuario no autenticado NO puede crear un perfil", async () => {
        const db = unauthenticatedDb();

        await assertFails(
            db.collection("users").doc("user-1").set({
                uid: "user-1",
                email: "user1@test.com",
                displayName: "User 1",
                photoURL: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
        );
    });

    test("usuario NO puede crear el perfil de otro usuario", async () => {
        const user = authenticatedUser("user-1", "user1@test.com");
        const db = user.firestore();

        await assertFails(
            db.collection("users").doc("user-2").set({
                uid: "user-2",
                email: "user2@test.com",
                displayName: "User 2",
                photoURL: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
        );
    });
});

// ============================================================================
// BANDS
// ============================================================================

describe("BANDS - Bandas", () => {
    test("usuario autenticado puede crear una banda siendo owner", async () => {
        const user = authenticatedUser("owner-1", "owner@test.com");
        const db = user.firestore();

        await assertSucceeds(
            db.collection("bands").doc("band-1").set({
                name: "Banda Test",
                ownerId: "owner-1",
                createdAt: new Date(),
            })
        );
    });

    test("usuario NO puede crear una banda asignando otro ownerId", async () => {
        const user = authenticatedUser("user-1", "user1@test.com");
        const db = user.firestore();

        await assertFails(
            db.collection("bands").doc("band-1").set({
                name: "Banda Test",
                ownerId: "otro-user",
                createdAt: new Date(),
            })
        );
    });

    test("usuario no autenticado NO puede crear una banda", async () => {
        const db = unauthenticatedDb();

        await assertFails(
            db.collection("bands").doc("band-1").set({
                name: "Banda Test",
                ownerId: "owner-1",
                createdAt: new Date(),
            })
        );
    });

    test("owner puede actualizar su banda", async () => {
        await createBandWithOwner();

        const user = authenticatedUser("owner-1", "owner@test.com");
        const db = user.firestore();

        await assertSucceeds(
            db.collection("bands").doc("band-1").update({
                name: "Nombre Nuevo",
            })
        );
    });

    test("owner NO puede cambiar ownerId", async () => {
        await createBandWithOwner();

        const user = authenticatedUser("owner-1", "owner@test.com");
        const db = user.firestore();

        await assertFails(
            db.collection("bands").doc("band-1").update({
                ownerId: "otro-user",
            })
        );
    });

    test("usuario que NO es miembro NO puede leer la banda", async () => {
        await createBandWithOwner();

        const user = authenticatedUser("outsider", "outsider@test.com");
        const db = user.firestore();

        await assertFails(
            db.collection("bands").doc("band-1").get()
        );
    });
});

// ============================================================================
// MEMBERS
// ============================================================================

describe("MEMBERS - Miembros de banda", () => {
    test("owner inicial puede crearse junto con la banda mediante batch", async () => {
        await assertSucceeds(
            createBandWithOwner({
                uid: "owner-1",
                email: "owner@test.com",
                bandId: "band-1",
            })
        );
    });

    test("usuario NO puede crearse como owner de una banda existente si no es el owner", async () => {
        await createBandWithOwner();

        const user = authenticatedUser("attacker", "attacker@test.com");
        const db = user.firestore();

        await assertFails(
            db
                .collection("bands")
                .doc("band-1")
                .collection("members")
                .doc("attacker")
                .set({
                    role: "owner",
                    email: "attacker@test.com",
                })
        );
    });

    test("owner puede agregar un miembro", async () => {
        await createBandWithOwner();

        const user = authenticatedUser("owner-1", "owner@test.com");
        const db = user.firestore();

        await assertSucceeds(
            db
                .collection("bands")
                .doc("band-1")
                .collection("members")
                .doc("member-1")
                .set({
                    role: "member",
                    email: "member@test.com",
                })
        );
    });

    test("owner puede agregar un director", async () => {
        await createBandWithOwner();

        const user = authenticatedUser("owner-1", "owner@test.com");
        const db = user.firestore();

        await assertSucceeds(
            db
                .collection("bands")
                .doc("band-1")
                .collection("members")
                .doc("director-1")
                .set({
                    role: "director",
                    email: "director@test.com",
                })
        );
    });

    test("owner NO puede agregar otro owner", async () => {
        await createBandWithOwner();

        const user = authenticatedUser("owner-1", "owner@test.com");
        const db = user.firestore();

        await assertFails(
            db
                .collection("bands")
                .doc("band-1")
                .collection("members")
                .doc("user-2")
                .set({
                    role: "owner",
                    email: "user2@test.com",
                })
        );
    });

    test("miembro normal NO puede agregar otro miembro", async () => {
        await createBandWithOwner();

        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await assertSucceeds(
            ownerDb
                .collection("bands")
                .doc("band-1")
                .collection("members")
                .doc("member-1")
                .set({
                    role: "member",
                    email: "member@test.com",
                })
        );

        const member = authenticatedUser("member-1", "member@test.com");
        const db = member.firestore();

        await assertFails(
            db
                .collection("bands")
                .doc("band-1")
                .collection("members")
                .doc("member-2")
                .set({
                    role: "member",
                    email: "member2@test.com",
                })
        );
    });

    test("miembro puede leer su propio documento", async () => {
        await createBandWithOwner();

        const user = authenticatedUser("owner-1", "owner@test.com");
        const db = user.firestore();

        await assertSucceeds(
            db
                .collection("bands")
                .doc("band-1")
                .collection("members")
                .doc("owner-1")
                .get()
        );
    });

    test("miembro puede abandonar la banda eliminándose a sí mismo", async () => {
        await createBandWithOwner();

        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await assertSucceeds(
            ownerDb
                .collection("bands")
                .doc("band-1")
                .collection("members")
                .doc("member-1")
                .set({
                    role: "member",
                    email: "member@test.com",
                })
        );

        const member = authenticatedUser("member-1", "member@test.com");
        const db = member.firestore();

        await assertSucceeds(
            db
                .collection("bands")
                .doc("band-1")
                .collection("members")
                .doc("member-1")
                .delete()
        );
    });

    test("owner NO puede eliminarse a sí mismo", async () => {
        await createBandWithOwner();

        const user = authenticatedUser("owner-1", "owner@test.com");
        const db = user.firestore();

        await assertFails(
            db
                .collection("bands")
                .doc("band-1")
                .collection("members")
                .doc("owner-1")
                .delete()
        );
    });
});

// ============================================================================
// INVITATIONS
// ============================================================================

describe("INVITATIONS - Invitaciones", () => {
    test("owner puede crear una invitación para member", async () => {
        await createBandWithOwner();

        const user = authenticatedUser("owner-1", "owner@test.com");
        const db = user.firestore();

        await assertSucceeds(
            db.collection("invitations").doc("inv-1").set({
                bandId: "band-1",
                invitedEmail: "newuser@test.com",
                invitedByUserId: "owner-1",
                role: "member",
                status: "pending",
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            })
        );
    });

    test("owner puede crear una invitación para director", async () => {
        await createBandWithOwner();

        const user = authenticatedUser("owner-1", "owner@test.com");
        const db = user.firestore();

        await assertSucceeds(
            db.collection("invitations").doc("inv-1").set({
                bandId: "band-1",
                invitedEmail: "director@test.com",
                invitedByUserId: "owner-1",
                role: "director",
                status: "pending",
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            })
        );
    });

    test("owner NO puede invitar con rol owner", async () => {
        await createBandWithOwner();

        const user = authenticatedUser("owner-1", "owner@test.com");
        const db = user.firestore();

        await assertFails(
            db.collection("invitations").doc("inv-1").set({
                bandId: "band-1",
                invitedEmail: "attacker@test.com",
                invitedByUserId: "owner-1",
                role: "owner",
                status: "pending",
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            })
        );
    });

    test("director NO puede invitar otro director", async () => {
        await createBandWithOwner();

        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await assertSucceeds(
            ownerDb
                .collection("bands")
                .doc("band-1")
                .collection("members")
                .doc("director-1")
                .set({
                    role: "director",
                    email: "director@test.com",
                })
        );

        const director = authenticatedUser(
            "director-1",
            "director@test.com"
        );

        const db = director.firestore();

        await assertFails(
            db.collection("invitations").doc("inv-1").set({
                bandId: "band-1",
                invitedEmail: "newdirector@test.com",
                invitedByUserId: "director-1",
                role: "director",
                status: "pending",
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            })
        );
    });

    test("director puede invitar un member", async () => {
        await createBandWithOwner();

        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await assertSucceeds(
            ownerDb
                .collection("bands")
                .doc("band-1")
                .collection("members")
                .doc("director-1")
                .set({
                    role: "director",
                    email: "director@test.com",
                })
        );

        const director = authenticatedUser(
            "director-1",
            "director@test.com"
        );

        const db = director.firestore();

        await assertSucceeds(
            db.collection("invitations").doc("inv-1").set({
                bandId: "band-1",
                invitedEmail: "newmember@test.com",
                invitedByUserId: "director-1",
                role: "member",
                status: "pending",
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            })
        );
    });

    test("usuario invitado puede leer su invitación", async () => {
        await createBandWithOwner();

        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await assertSucceeds(
            ownerDb.collection("invitations").doc("inv-1").set({
                bandId: "band-1",
                invitedEmail: "invited@test.com",
                invitedByUserId: "owner-1",
                role: "member",
                status: "pending",
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            })
        );

        const invited = authenticatedUser(
            "invited-1",
            "invited@test.com"
        );

        const db = invited.firestore();

        await assertSucceeds(
            db.collection("invitations").doc("inv-1").get()
        );
    });

    test("usuario que NO es invitado NO puede leer la invitación", async () => {
        await createBandWithOwner();

        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await assertSucceeds(
            ownerDb.collection("invitations").doc("inv-1").set({
                bandId: "band-1",
                invitedEmail: "invited@test.com",
                invitedByUserId: "owner-1",
                role: "member",
                status: "pending",
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            })
        );

        const attacker = authenticatedUser(
            "attacker",
            "attacker@test.com"
        );

        const db = attacker.firestore();

        await assertFails(
            db.collection("invitations").doc("inv-1").get()
        );
    });
});

// ============================================================================
// INVITATION ACCEPTANCE
// ============================================================================

describe("INVITATIONS - Aceptación", () => {
    async function createPendingInvitation({
        invitationId = "inv-1",
        invitedEmail = "invited@test.com",
        role = "member",
        expiresAt = new Date(Date.now() + 60 * 60 * 1000),
    } = {}) {
        const owner = authenticatedUser("owner-1", "owner@test.com");
        const db = owner.firestore();

        await assertSucceeds(
            db.collection("invitations").doc(invitationId).set({
                bandId: "band-1",
                invitedEmail,
                invitedByUserId: "owner-1",
                role,
                status: "pending",
                expiresAt,
            })
        );
    }

    test("usuario invitado NO puede aceptar la invitación sin crear miembro", async () => {
        await createBandWithOwner();

        await createPendingInvitation({
            invitedEmail: "invited@test.com",
        });

        const invited = authenticatedUser(
            "invited-1",
            "invited@test.com"
        );

        const db = invited.firestore();

        await assertFails(
            db.collection("invitations").doc("inv-1").update({
                status: "accepted",
                invitedUserId: "invited-1",
            })
        );
    });

    test("usuario invitado NO puede aceptar con otro invitedUserId", async () => {
        await createBandWithOwner();

        await createPendingInvitation({
            invitedEmail: "invited@test.com",
        });

        const invited = authenticatedUser(
            "invited-1",
            "invited@test.com"
        );

        const db = invited.firestore();

        await assertFails(
            db.collection("invitations").doc("inv-1").update({
                status: "accepted",
                invitedUserId: "otro-usuario",
            })
        );
    });

    test("usuario NO invitado NO puede aceptar la invitación", async () => {
        await createBandWithOwner();

        await createPendingInvitation({
            invitedEmail: "invited@test.com",
        });

        const attacker = authenticatedUser(
            "attacker",
            "attacker@test.com"
        );

        const db = attacker.firestore();

        await assertFails(
            db.collection("invitations").doc("inv-1").update({
                status: "accepted",
                invitedUserId: "attacker",
            })
        );
    });

    test("invitación vencida NO puede ser aceptada", async () => {
        await createBandWithOwner();

        await createPendingInvitation({
            invitedEmail: "invited@test.com",
            expiresAt: new Date(Date.now() - 60 * 1000),
        });

        const invited = authenticatedUser(
            "invited-1",
            "invited@test.com"
        );

        const db = invited.firestore();

        await assertFails(
            db.collection("invitations").doc("inv-1").update({
                status: "accepted",
                invitedUserId: "invited-1",
            })
        );
    });

    test("usuario invitado NO puede modificar otros campos de la invitación", async () => {
        await createBandWithOwner();

        await createPendingInvitation({
            invitedEmail: "invited@test.com",
        });

        const invited = authenticatedUser(
            "invited-1",
            "invited@test.com"
        );

        const db = invited.firestore();

        await assertFails(
            db.collection("invitations").doc("inv-1").update({
                status: "accepted",
                invitedUserId: "invited-1",
                role: "director",
            })
        );
    });

    test("usuario invitado NO puede modificar invitedEmail al aceptar", async () => {
        await createBandWithOwner();

        await createPendingInvitation({
            invitedEmail: "invited@test.com",
        });

        const invited = authenticatedUser(
            "invited-1",
            "invited@test.com"
        );

        const db = invited.firestore();

        await assertFails(
            db.collection("invitations").doc("inv-1").update({
                status: "accepted",
                invitedUserId: "invited-1",
                invitedEmail: "attacker@test.com",
            })
        );
    });

    test("usuario invitado NO puede modificar bandId al aceptar", async () => {
        await createBandWithOwner();

        await createPendingInvitation({
            invitedEmail: "invited@test.com",
        });

        const invited = authenticatedUser(
            "invited-1",
            "invited@test.com"
        );

        const db = invited.firestore();

        await assertFails(
            db.collection("invitations").doc("inv-1").update({
                status: "accepted",
                invitedUserId: "invited-1",
                bandId: "band-2",
            })
        );
    });
});

// ============================================================================
// CRITICAL: ATOMIC INVITATION + MEMBER JOIN
// ============================================================================

describe("CRÍTICO - Aceptación atómica + creación de miembro", () => {
    async function setupInvitation() {
        await createBandWithOwner();

        const owner = authenticatedUser("owner-1", "owner@test.com");
        const db = owner.firestore();

        await assertSucceeds(
            db.collection("invitations").doc("inv-1").set({
                bandId: "band-1",
                invitedEmail: "invited@test.com",
                invitedByUserId: "owner-1",
                role: "member",
                status: "pending",
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            })
        );
    }

    test("aceptar invitación + crear miembro EN EL MISMO BATCH debe funcionar", async () => {
        await setupInvitation();

        const invited = authenticatedUser(
            "invited-1",
            "invited@test.com"
        );

        const db = invited.firestore();

        const batch = db.batch();

        const invitationRef = db
            .collection("invitations")
            .doc("inv-1");

        const memberRef = db
            .collection("bands")
            .doc("band-1")
            .collection("members")
            .doc("invited-1");

        batch.update(invitationRef, {
            status: "accepted",
            invitedUserId: "invited-1",
        });

        batch.set(memberRef, {
            role: "member",
            email: "invited@test.com",
            invitationId: "inv-1",
        });

        await assertSucceeds(batch.commit());
    });

    test("crear miembro SIN aceptar la invitación debe fallar", async () => {
        await setupInvitation();

        const invited = authenticatedUser(
            "invited-1",
            "invited@test.com"
        );

        const db = invited.firestore();

        await assertFails(
            db
                .collection("bands")
                .doc("band-1")
                .collection("members")
                .doc("invited-1")
                .set({
                    role: "member",
                    email: "invited@test.com",
                    invitationId: "inv-1",
                })
        );
    });

    test("aceptar invitación SIN crear miembro debe fallar", async () => {
        await setupInvitation();

        const invited = authenticatedUser(
            "invited-1",
            "invited@test.com"
        );

        const db = invited.firestore();

        await assertFails(
            db.collection("invitations").doc("inv-1").update({
                status: "accepted",
                invitedUserId: "invited-1",
            })
        );
    });

    test("crear miembro con invitationId de otra banda debe fallar", async () => {
        await setupInvitation();

        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await assertSucceeds(
            ownerDb.collection("bands").doc("band-2").set({
                name: "Otra Banda",
                ownerId: "owner-1",
                createdAt: new Date(),
            })
        );

        const invited = authenticatedUser(
            "invited-1",
            "invited@test.com"
        );

        const db = invited.firestore();

        const batch = db.batch();

        const invitationRef = db
            .collection("invitations")
            .doc("inv-1");

        const memberRef = db
            .collection("bands")
            .doc("band-2")
            .collection("members")
            .doc("invited-1");

        batch.update(invitationRef, {
            status: "accepted",
            invitedUserId: "invited-1",
        });

        batch.set(memberRef, {
            role: "member",
            email: "invited@test.com",
            invitationId: "inv-1",
        });

        await assertFails(batch.commit());
    });

    test("crear miembro con rol diferente al de la invitación debe fallar", async () => {
        await setupInvitation();

        const invited = authenticatedUser(
            "invited-1",
            "invited@test.com"
        );

        const db = invited.firestore();

        const batch = db.batch();

        const invitationRef = db
            .collection("invitations")
            .doc("inv-1");

        const memberRef = db
            .collection("bands")
            .doc("band-1")
            .collection("members")
            .doc("invited-1");

        batch.update(invitationRef, {
            status: "accepted",
            invitedUserId: "invited-1",
        });

        batch.set(memberRef, {
            role: "director",
            email: "invited@test.com",
            invitationId: "inv-1",
        });

        await assertFails(batch.commit());
    });

    test("invitación vencida + creación de miembro debe fallar", async () => {
        await createBandWithOwner();

        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await assertSucceeds(
            ownerDb.collection("invitations").doc("inv-1").set({
                bandId: "band-1",
                invitedEmail: "invited@test.com",
                invitedByUserId: "owner-1",
                role: "member",
                status: "pending",
                expiresAt: new Date(Date.now() - 60 * 1000),
            })
        );

        const invited = authenticatedUser(
            "invited-1",
            "invited@test.com"
        );

        const db = invited.firestore();

        const batch = db.batch();

        batch.update(
            db.collection("invitations").doc("inv-1"),
            {
                status: "accepted",
                invitedUserId: "invited-1",
            }
        );

        batch.set(
            db
                .collection("bands")
                .doc("band-1")
                .collection("members")
                .doc("invited-1"),
            {
                role: "member",
                email: "invited@test.com",
                invitationId: "inv-1",
            }
        );

        await assertFails(batch.commit());
    });

    test("invitación ya aceptada NO puede aceptarse nuevamente", async () => {
        await setupInvitation();

        const invited = authenticatedUser(
            "invited-1",
            "invited@test.com"
        );

        const db = invited.firestore();

        const batch = db.batch();

        batch.update(
            db.collection("invitations").doc("inv-1"),
            {
                status: "accepted",
                invitedUserId: "invited-1",
            }
        );

        batch.set(
            db
                .collection("bands")
                .doc("band-1")
                .collection("members")
                .doc("invited-1"),
            {
                role: "member",
                email: "invited@test.com",
                invitationId: "inv-1",
            }
        );

        await assertSucceeds(batch.commit());

        await assertFails(
            db.collection("invitations").doc("inv-1").update({
                status: "accepted",
                invitedUserId: "invited-1",
            })
        );
    });
});

// ============================================================================
// SETLISTS - Listas personales (independientes de bandas)
// ============================================================================

describe("SETLISTS - Listas personales", () => {
    // Un usuario sin banda puede crear su propio setlist.
    test("usuario autenticado puede crear su propio setlist", async () => {
        const user = authenticatedUser("user-1", "user1@test.com");
        const db = user.firestore();

        await assertSucceeds(
            db.collection("setlists").doc("setlist-1").set({
                user_id: "user-1",
                name: "Mi Lista",
                song_ids: [],
                is_public: false,
                created_at: new Date().toISOString(),
            })
        );
    });

    test("usuario no autenticado NO puede crear un setlist", async () => {
        const db = unauthenticatedDb();

        await assertFails(
            db.collection("setlists").doc("setlist-1").set({
                user_id: "user-1",
                name: "Mi Lista",
                song_ids: [],
                is_public: false,
                created_at: new Date().toISOString(),
            })
        );
    });

    test("usuario autenticado NO puede crear un setlist con user_id ajeno", async () => {
        const user = authenticatedUser("user-1", "user1@test.com");
        const db = user.firestore();

        await assertFails(
            db.collection("setlists").doc("setlist-1").set({
                user_id: "otro-user",
                name: "Lista Falsa",
                song_ids: [],
                is_public: false,
            })
        );
    });

    test("usuario puede leer su propio setlist privado", async () => {
        const owner = authenticatedUser("user-1", "user1@test.com");
        const ownerDb = owner.firestore();

        await ownerDb.collection("setlists").doc("setlist-1").set({
            user_id: "user-1",
            name: "Lista Privada",
            song_ids: [],
            is_public: false,
        });

        await assertSucceeds(
            ownerDb.collection("setlists").doc("setlist-1").get()
        );
    });

    test("usuario puede leer un setlist público de otro usuario", async () => {
        const owner = authenticatedUser("user-1", "user1@test.com");
        const ownerDb = owner.firestore();

        await ownerDb.collection("setlists").doc("setlist-public").set({
            user_id: "user-1",
            name: "Lista Pública",
            song_ids: [],
            is_public: true,
        });

        const reader = authenticatedUser("user-2", "user2@test.com");
        const readerDb = reader.firestore();

        await assertSucceeds(
            readerDb.collection("setlists").doc("setlist-public").get()
        );
    });

    test("usuario NO puede leer un setlist privado de otro usuario", async () => {
        const owner = authenticatedUser("user-1", "user1@test.com");
        const ownerDb = owner.firestore();

        await ownerDb.collection("setlists").doc("setlist-private").set({
            user_id: "user-1",
            name: "Lista Privada",
            song_ids: [],
            is_public: false,
        });

        const attacker = authenticatedUser("user-2", "user2@test.com");
        const attackerDb = attacker.firestore();

        await assertFails(
            attackerDb.collection("setlists").doc("setlist-private").get()
        );
    });

    test("usuario puede modificar su propio setlist", async () => {
        const user = authenticatedUser("user-1", "user1@test.com");
        const db = user.firestore();

        await db.collection("setlists").doc("setlist-1").set({
            user_id: "user-1",
            name: "Lista Original",
            song_ids: [],
            is_public: false,
        });

        await assertSucceeds(
            db.collection("setlists").doc("setlist-1").update({
                name: "Lista Actualizada",
                user_id: "user-1",
            })
        );
    });

    test("usuario NO puede modificar el setlist de otro usuario", async () => {
        const owner = authenticatedUser("user-1", "user1@test.com");
        const ownerDb = owner.firestore();

        await ownerDb.collection("setlists").doc("setlist-1").set({
            user_id: "user-1",
            name: "Lista del Owner",
            song_ids: [],
            is_public: false,
        });

        const attacker = authenticatedUser("user-2", "user2@test.com");
        const attackerDb = attacker.firestore();

        await assertFails(
            attackerDb.collection("setlists").doc("setlist-1").update({
                name: "Lista Hackeada",
            })
        );
    });

    test("usuario NO puede cambiar user_id de su setlist a otro UID", async () => {
        const user = authenticatedUser("user-1", "user1@test.com");
        const db = user.firestore();

        await db.collection("setlists").doc("setlist-1").set({
            user_id: "user-1",
            name: "Lista",
            song_ids: [],
            is_public: false,
        });

        await assertFails(
            db.collection("setlists").doc("setlist-1").update({
                user_id: "user-2",
                name: "Lista Transferida",
            })
        );
    });

    test("usuario puede eliminar su propio setlist", async () => {
        const user = authenticatedUser("user-1", "user1@test.com");
        const db = user.firestore();

        await db.collection("setlists").doc("setlist-1").set({
            user_id: "user-1",
            name: "Lista a Eliminar",
            song_ids: [],
            is_public: false,
        });

        await assertSucceeds(
            db.collection("setlists").doc("setlist-1").delete()
        );
    });

    test("usuario NO puede eliminar el setlist de otro usuario", async () => {
        const owner = authenticatedUser("user-1", "user1@test.com");
        const ownerDb = owner.firestore();

        await ownerDb.collection("setlists").doc("setlist-1").set({
            user_id: "user-1",
            name: "Lista del Owner",
            song_ids: [],
            is_public: false,
        });

        const attacker = authenticatedUser("user-2", "user2@test.com");
        const attackerDb = attacker.firestore();

        await assertFails(
            attackerDb.collection("setlists").doc("setlist-1").delete()
        );
    });

    test("LEGACY: documento setlist sin user_id NO puede ser modificado por terceros", async () => {
        // Simula un documento legacy creado sin user_id (por la versión anterior).
        // Se inserta via testEnv.withSecurityRulesDisabled para simular estado legacy.
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await ctx.firestore()
                .collection("setlists")
                .doc("setlist-legacy")
                .set({
                    name: "Lista Legacy Sin Owner",
                    song_ids: [],
                    is_public: false,
                    // Intencionalmente sin user_id
                });
        });

        const attacker = authenticatedUser("user-2", "user2@test.com");
        const attackerDb = attacker.firestore();

        // Con las reglas hardening, un doc sin user_id debe ser RECHAZADO para update y delete.
        await assertFails(
            attackerDb.collection("setlists").doc("setlist-legacy").update({
                name: "Atacado",
            })
        );

        await assertFails(
            attackerDb.collection("setlists").doc("setlist-legacy").delete()
        );
    });
});

// ============================================================================
// INVITATIONS - Expiración (sin escritura client-side de 'expired')
// ============================================================================

describe("INVITATIONS - Expiración de invitaciones", () => {
    async function setupExpiredInvitation() {
        await createBandWithOwner();

        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await assertSucceeds(
            ownerDb.collection("invitations").doc("inv-expired").set({
                bandId: "band-1",
                invitedEmail: "invited@test.com",
                invitedByUserId: "owner-1",
                role: "member",
                status: "pending",
                expiresAt: new Date(Date.now() - 60 * 1000), // ya venció
            })
        );
    }

    test("invitación vencida NO puede aceptarse via batch", async () => {
        await setupExpiredInvitation();

        const invited = authenticatedUser("invited-1", "invited@test.com");
        const db = invited.firestore();

        const batch = db.batch();

        batch.update(db.collection("invitations").doc("inv-expired"), {
            status: "accepted",
            invitedUserId: "invited-1",
        });

        batch.set(
            db.collection("bands").doc("band-1").collection("members").doc("invited-1"),
            {
                role: "member",
                email: "invited@test.com",
                invitationId: "inv-expired",
            }
        );

        await assertFails(batch.commit());
    });

    test("invitación vigente puede aceptarse via batch sin escribir 'expired'", async () => {
        await createBandWithOwner();

        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await assertSucceeds(
            ownerDb.collection("invitations").doc("inv-valid").set({
                bandId: "band-1",
                invitedEmail: "invited@test.com",
                invitedByUserId: "owner-1",
                role: "member",
                status: "pending",
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            })
        );

        const invited = authenticatedUser("invited-1", "invited@test.com");
        const db = invited.firestore();

        const batch = db.batch();

        batch.update(db.collection("invitations").doc("inv-valid"), {
            status: "accepted",
            invitedUserId: "invited-1",
        });

        batch.set(
            db.collection("bands").doc("band-1").collection("members").doc("invited-1"),
            {
                role: "member",
                email: "invited@test.com",
                invitationId: "inv-valid",
            }
        );

        await assertSucceeds(batch.commit());
    });

    test("cliente NO puede escribir status 'expired' en una invitación vencida", async () => {
        await setupExpiredInvitation();

        const invited = authenticatedUser("invited-1", "invited@test.com");
        const db = invited.firestore();

        // Esto es lo que InvitationService.ts solía intentar hacer. Debe fallar.
        await assertFails(
            db.collection("invitations").doc("inv-expired").update({
                status: "expired",
            })
        );
    });
});

// ============================================================================
// AUDITORÍA DE SEGURIDAD EXHAUSTIVA Y PENETRACIÓN
// ============================================================================

describe("AUDITORÍA DE SEGURIDAD - INVITACIONES AVANZADO", () => {
    test("director NO puede crear invitación con rol director", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await ownerDb.collection("bands").doc("band-1").collection("members").doc("director-1").set({
            role: "director",
            email: "director@test.com"
        });

        const director = authenticatedUser("director-1", "director@test.com");
        const directorDb = director.firestore();

        await assertFails(
            directorDb.collection("invitations").doc("inv-dir-1").set({
                bandId: "band-1",
                invitedEmail: "newdir@test.com",
                invitedByUserId: "director-1",
                role: "director",
                status: "pending",
                expiresAt: new Date(Date.now() + 60000)
            })
        );
    });

    test("director NO puede crear invitación con rol owner", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await ownerDb.collection("bands").doc("band-1").collection("members").doc("director-1").set({
            role: "director",
            email: "director@test.com"
        });

        const director = authenticatedUser("director-1", "director@test.com");
        const directorDb = director.firestore();

        await assertFails(
            directorDb.collection("invitations").doc("inv-own-1").set({
                bandId: "band-1",
                invitedEmail: "newowner@test.com",
                invitedByUserId: "director-1",
                role: "owner",
                status: "pending",
                expiresAt: new Date(Date.now() + 60000)
            })
        );
    });

    test("durante la aceptación NO se puede modificar campos inmutables de la invitación (bandId, role, invitedEmail, expiresAt)", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await ownerDb.collection("invitations").doc("inv-immutable").set({
            bandId: "band-1",
            invitedEmail: "invited@test.com",
            invitedByUserId: "owner-1",
            role: "member",
            status: "pending",
            expiresAt: new Date(Date.now() + 60000)
        });

        const invited = authenticatedUser("invited-1", "invited@test.com");
        const db = invited.firestore();

        const batch = db.batch();
        batch.update(db.collection("invitations").doc("inv-immutable"), {
            status: "accepted",
            invitedUserId: "invited-1",
            bandId: "other-band",
        });
        batch.set(db.collection("bands").doc("band-1").collection("members").doc("invited-1"), {
            role: "member",
            email: "invited@test.com",
            invitationId: "inv-immutable"
        });

        await assertFails(batch.commit());
    });

    test("usuario con email coincidente NO puede aceptar creando miembro para otro UID", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await ownerDb.collection("invitations").doc("inv-mismatch").set({
            bandId: "band-1",
            invitedEmail: "invited@test.com",
            invitedByUserId: "owner-1",
            role: "member",
            status: "pending",
            expiresAt: new Date(Date.now() + 60000)
        });

        const invited = authenticatedUser("invited-1", "invited@test.com");
        const db = invited.firestore();

        const batch = db.batch();
        batch.update(db.collection("invitations").doc("inv-mismatch"), {
            status: "accepted",
            invitedUserId: "other-uid",
        });
        batch.set(db.collection("bands").doc("band-1").collection("members").doc("invited-1"), {
            role: "member",
            email: "invited@test.com",
            invitationId: "inv-mismatch"
        });

        await assertFails(batch.commit());
    });

    test("invitación en estado rejected NO puede volver a aceptarse", async () => {
        await createBandWithOwner();

        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await ctx.firestore().collection("invitations").doc("inv-rejected").set({
                bandId: "band-1",
                invitedEmail: "invited@test.com",
                invitedByUserId: "owner-1",
                role: "member",
                status: "rejected",
                expiresAt: new Date(Date.now() + 60000)
            });
        });

        const invited = authenticatedUser("invited-1", "invited@test.com");
        const db = invited.firestore();

        const batch = db.batch();
        batch.update(db.collection("invitations").doc("inv-rejected"), {
            status: "accepted",
            invitedUserId: "invited-1",
        });
        batch.set(db.collection("bands").doc("band-1").collection("members").doc("invited-1"), {
            role: "member",
            email: "invited@test.com",
            invitationId: "inv-rejected"
        });

        await assertFails(batch.commit());
    });

    test("invitación en estado cancelled NO puede volver a aceptarse", async () => {
        await createBandWithOwner();

        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await ctx.firestore().collection("invitations").doc("inv-cancelled").set({
                bandId: "band-1",
                invitedEmail: "invited@test.com",
                invitedByUserId: "owner-1",
                role: "member",
                status: "cancelled",
                expiresAt: new Date(Date.now() + 60000)
            });
        });

        const invited = authenticatedUser("invited-1", "invited@test.com");
        const db = invited.firestore();

        const batch = db.batch();
        batch.update(db.collection("invitations").doc("inv-cancelled"), {
            status: "accepted",
            invitedUserId: "invited-1",
        });
        batch.set(db.collection("bands").doc("band-1").collection("members").doc("invited-1"), {
            role: "member",
            email: "invited@test.com",
            invitationId: "inv-cancelled"
        });

        await assertFails(batch.commit());
    });

    test("crear miembro con invitationId pero actualizando la invitación a estado 'rejected' debe fallar", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await ownerDb.collection("invitations").doc("inv-trick").set({
            bandId: "band-1",
            invitedEmail: "invited@test.com",
            invitedByUserId: "owner-1",
            role: "member",
            status: "pending",
            expiresAt: new Date(Date.now() + 60000)
        });

        const invited = authenticatedUser("invited-1", "invited@test.com");
        const db = invited.firestore();

        const batch = db.batch();
        batch.update(db.collection("invitations").doc("inv-trick"), {
            status: "rejected"
        });
        batch.set(db.collection("bands").doc("band-1").collection("members").doc("invited-1"), {
            role: "member",
            email: "invited@test.com",
            invitationId: "inv-trick"
        });

        await assertFails(batch.commit());
    });

    test("ataque sobre isValidInvitationJoin: atacante con email distinto intenta usar invitedUserId pre-seteado", async () => {
        await createBandWithOwner();

        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await ctx.firestore().collection("invitations").doc("inv-exploit").set({
                bandId: "band-1",
                invitedEmail: "victima@test.com",
                invitedByUserId: "owner-1",
                invitedUserId: "attacker-1",
                role: "member",
                status: "pending",
                expiresAt: new Date(Date.now() + 60000)
            });
        });

        const attacker = authenticatedUser("attacker-1", "attacker@test.com");
        const attackerDb = attacker.firestore();

        const batch = attackerDb.batch();
        batch.update(attackerDb.collection("invitations").doc("inv-exploit"), {
            status: "accepted",
            invitedUserId: "attacker-1"
        });
        batch.set(attackerDb.collection("bands").doc("band-1").collection("members").doc("attacker-1"), {
            role: "member",
            email: "attacker@test.com",
            invitationId: "inv-exploit"
        });

        await assertFails(batch.commit());
    });

    test("director puede leer invitaciones de su banda", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await ownerDb.collection("bands").doc("band-1").collection("members").doc("director-1").set({
            role: "director",
            email: "director@test.com"
        });

        await ownerDb.collection("invitations").doc("inv-1").set({
            bandId: "band-1",
            invitedEmail: "any@test.com",
            invitedByUserId: "owner-1",
            role: "member",
            status: "pending",
            expiresAt: new Date(Date.now() + 60000)
        });

        const director = authenticatedUser("director-1", "director@test.com");
        await assertSucceeds(
            director.firestore().collection("invitations").doc("inv-1").get()
        );
    });

    test("miembro normal NO puede cancelar una invitación", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await ownerDb.collection("bands").doc("band-1").collection("members").doc("member-1").set({
            role: "member",
            email: "member@test.com"
        });

        await ownerDb.collection("invitations").doc("inv-cancel").set({
            bandId: "band-1",
            invitedEmail: "target@test.com",
            invitedByUserId: "owner-1",
            role: "member",
            status: "pending",
            expiresAt: new Date(Date.now() + 60000)
        });

        const member = authenticatedUser("member-1", "member@test.com");
        await assertFails(
            member.firestore().collection("invitations").doc("inv-cancel").update({
                status: "cancelled"
            })
        );
    });
});

describe("AUDITORÍA DE SEGURIDAD - MIEMBROS Y ROLES", () => {
    test("member NO puede crear miembros directamente", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        await owner.firestore().collection("bands").doc("band-1").collection("members").doc("member-1").set({
            role: "member",
            email: "member@test.com"
        });

        const member = authenticatedUser("member-1", "member@test.com");
        await assertFails(
            member.firestore().collection("bands").doc("band-1").collection("members").doc("new-member").set({
                role: "member",
                email: "new@test.com"
            })
        );
    });

    test("director NO puede crear miembros directamente", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        await owner.firestore().collection("bands").doc("band-1").collection("members").doc("director-1").set({
            role: "director",
            email: "director@test.com"
        });

        const director = authenticatedUser("director-1", "director@test.com");
        await assertFails(
            director.firestore().collection("bands").doc("band-1").collection("members").doc("new-member").set({
                role: "member",
                email: "new@test.com"
            })
        );
    });

    test("member NO puede modificar su propio documento de miembro para ser owner o director", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        await owner.firestore().collection("bands").doc("band-1").collection("members").doc("member-1").set({
            role: "member",
            email: "member@test.com"
        });

        const member = authenticatedUser("member-1", "member@test.com");
        await assertFails(
            member.firestore().collection("bands").doc("band-1").collection("members").doc("member-1").update({
                role: "owner"
            })
        );

        await assertFails(
            member.firestore().collection("bands").doc("band-1").collection("members").doc("member-1").update({
                role: "director"
            })
        );
    });

    test("director NO puede modificar su propio documento de miembro para ser owner", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        await owner.firestore().collection("bands").doc("band-1").collection("members").doc("director-1").set({
            role: "director",
            email: "director@test.com"
        });

        const director = authenticatedUser("director-1", "director@test.com");
        await assertFails(
            director.firestore().collection("bands").doc("band-1").collection("members").doc("director-1").update({
                role: "owner"
            })
        );
    });

    test("member NO puede modificar el documento de otro miembro", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        await owner.firestore().collection("bands").doc("band-1").collection("members").doc("member-1").set({
            role: "member",
            email: "member1@test.com"
        });
        await owner.firestore().collection("bands").doc("band-1").collection("members").doc("member-2").set({
            role: "member",
            email: "member2@test.com"
        });

        const member1 = authenticatedUser("member-1", "member1@test.com");
        await assertFails(
            member1.firestore().collection("bands").doc("band-1").collection("members").doc("member-2").update({
                displayName: "Hacked"
            })
        );
    });

    test("owner NO puede degradarse a sí mismo a member o director", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        await assertFails(
            owner.firestore().collection("bands").doc("band-1").collection("members").doc("owner-1").update({
                role: "member"
            })
        );
        await assertFails(
            owner.firestore().collection("bands").doc("band-1").collection("members").doc("owner-1").update({
                role: "director"
            })
        );
    });

    test("HARDENING: owner actualizando campos de un miembro (invitationId, joinedAt)", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        await owner.firestore().collection("bands").doc("band-1").collection("members").doc("member-1").set({
            role: "member",
            email: "member@test.com",
            invitationId: "inv-original",
            joinedAt: "2026-01-01T00:00:00.000Z"
        });

        const result = owner.firestore().collection("bands").doc("band-1").collection("members").doc("member-1").update({
            invitationId: "inv-tampered",
            joinedAt: "2026-08-25T00:00:00.000Z"
        });

        await assertSucceeds(result);
    });
});

describe("AUDITORÍA DE SEGURIDAD - SETLISTS PÚBLICOS Y COMPARTIDOS", () => {
    test("usuario autenticado puede LEER un setlist público de otro usuario", async () => {
        const owner = authenticatedUser("user-owner", "owner@test.com");
        await owner.firestore().collection("setlists").doc("setlist-pub-1").set({
            user_id: "user-owner",
            name: "Concierto Público",
            song_ids: ["song1", "song2"],
            is_public: true
        });

        const reader = authenticatedUser("user-reader", "reader@test.com");
        await assertSucceeds(
            reader.firestore().collection("setlists").doc("setlist-pub-1").get()
        );
    });

    test("usuario NO puede MODIFICAR un setlist público de otro usuario", async () => {
        const owner = authenticatedUser("user-owner", "owner@test.com");
        await owner.firestore().collection("setlists").doc("setlist-pub-1").set({
            user_id: "user-owner",
            name: "Concierto Público",
            song_ids: ["song1", "song2"],
            is_public: true
        });

        const attacker = authenticatedUser("user-attacker", "attacker@test.com");
        await assertFails(
            attacker.firestore().collection("setlists").doc("setlist-pub-1").update({
                name: "Setlist Hackeado",
                user_id: "user-attacker"
            })
        );
    });

    test("usuario NO puede ELIMINAR un setlist público de otro usuario", async () => {
        const owner = authenticatedUser("user-owner", "owner@test.com");
        await owner.firestore().collection("setlists").doc("setlist-pub-1").set({
            user_id: "user-owner",
            name: "Concierto Público",
            song_ids: ["song1", "song2"],
            is_public: true
        });

        const attacker = authenticatedUser("user-attacker", "attacker@test.com");
        await assertFails(
            attacker.firestore().collection("setlists").doc("setlist-pub-1").delete()
        );
    });
});

describe("AUDITORÍA DE SEGURIDAD - SESSIONS", () => {
    test("director A NO puede modificar sesión de director B", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        const ownerDb = owner.firestore();

        await ownerDb.collection("bands").doc("band-1").collection("members").doc("director-a").set({
            role: "director",
            email: "directora@test.com"
        });
        await ownerDb.collection("bands").doc("band-1").collection("members").doc("director-b").set({
            role: "director",
            email: "directorb@test.com"
        });

        const dirA = authenticatedUser("director-a", "directora@test.com");
        const batch = dirA.firestore().batch();
        batch.set(dirA.firestore().collection("bands").doc("band-1").collection("sessions").doc("session-a"), {
            bandId: "band-1",
            directorId: "director-a",
            status: "active",
            currentSongId: "song-1"
        });
        batch.update(dirA.firestore().collection("bands").doc("band-1"), {
            activeSessionId: "session-a"
        });
        await batch.commit();

        const dirB = authenticatedUser("director-b", "directorb@test.com");
        await assertFails(
            dirB.firestore().collection("bands").doc("band-1").collection("sessions").doc("session-a").update({
                currentSongId: "song-2"
            })
        );
    });

    test("director NO puede modificar bandId en una sesión", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        await owner.firestore().collection("bands").doc("band-1").collection("members").doc("director-a").set({
            role: "director",
            email: "directora@test.com"
        });

        const dirA = authenticatedUser("director-a", "directora@test.com");
        const batch = dirA.firestore().batch();
        batch.set(dirA.firestore().collection("bands").doc("band-1").collection("sessions").doc("session-a"), {
            bandId: "band-1",
            directorId: "director-a",
            status: "active"
        });
        batch.update(dirA.firestore().collection("bands").doc("band-1"), {
            activeSessionId: "session-a"
        });
        await batch.commit();

        await assertFails(
            dirA.firestore().collection("bands").doc("band-1").collection("sessions").doc("session-a").update({
                bandId: "other-band"
            })
        );
    });

    test("member NO puede crear una sesión", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        await owner.firestore().collection("bands").doc("band-1").collection("members").doc("member-1").set({
            role: "member",
            email: "member@test.com"
        });

        const member = authenticatedUser("member-1", "member@test.com");
        await assertFails(
            member.firestore().collection("bands").doc("band-1").collection("sessions").doc("sess-mem").set({
                bandId: "band-1",
                directorId: "member-1",
                status: "active"
            })
        );
    });

    test("owner PUEDE modificar la sesión de cualquier director y finalizarla con su activeSessionId", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        await owner.firestore().collection("bands").doc("band-1").collection("members").doc("director-a").set({
            role: "director",
            email: "directora@test.com"
        });

        const dirA = authenticatedUser("director-a", "directora@test.com");
        const batch = dirA.firestore().batch();
        batch.set(dirA.firestore().collection("bands").doc("band-1").collection("sessions").doc("session-a"), {
            bandId: "band-1",
            directorId: "director-a",
            status: "active"
        });
        batch.update(dirA.firestore().collection("bands").doc("band-1"), {
            activeSessionId: "session-a"
        });
        await batch.commit();

        const ownerBatch = owner.firestore().batch();
        ownerBatch.update(owner.firestore().collection("bands").doc("band-1").collection("sessions").doc("session-a"), {
            status: "ended"
        });
        ownerBatch.update(owner.firestore().collection("bands").doc("band-1"), {
            activeSessionId: null
        });

        await assertSucceeds(ownerBatch.commit());
    });
});

describe("AUDITORÍA DE SEGURIDAD - USERS Y PERFILES", () => {
    test("usuario NO puede modificar uid en su propio perfil", async () => {
        const user = authenticatedUser("user-1", "user1@test.com");
        const db = user.firestore();

        await db.collection("users").doc("user-1").set({
            uid: "user-1",
            email: "user1@test.com",
            displayName: "User One"
        });

        await assertFails(
            db.collection("users").doc("user-1").update({
                uid: "user-hacked"
            })
        );
    });

    test("usuario NO puede agregar campos no permitidos en su perfil", async () => {
        const user = authenticatedUser("user-1", "user1@test.com");
        const db = user.firestore();

        await assertFails(
            db.collection("users").doc("user-1").set({
                uid: "user-1",
                email: "user1@test.com",
                displayName: "User One",
                isAdmin: true
            })
        );
    });
});

describe("AUDITORÍA DE SEGURIDAD - QUERIES (WHERE)", () => {
    test("query invitations.where('invitedEmail', '==', email) funciona y es permitida", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        await owner.firestore().collection("invitations").doc("inv-q1").set({
            bandId: "band-1",
            invitedEmail: "target@test.com",
            invitedByUserId: "owner-1",
            role: "member",
            status: "pending",
            expiresAt: new Date(Date.now() + 60000)
        });

        const target = authenticatedUser("target-uid", "target@test.com");
        const query = target.firestore().collection("invitations").where("invitedEmail", "==", "target@test.com");
        
        await assertSucceeds(query.get());
    });

    test("query setlists.where('user_id', '==', uid) funciona y es permitida para el propio usuario", async () => {
        const user = authenticatedUser("user-1", "user1@test.com");
        const db = user.firestore();

        await db.collection("setlists").doc("setlist-q1").set({
            user_id: "user-1",
            name: "Lista Query",
            song_ids: [],
            is_public: false
        });

        const query = db.collection("setlists").where("user_id", "==", "user-1");
        await assertSucceeds(query.get());
    });

    test("query song_stats.where('user_id', '==', uid) funciona y es permitida para el propio usuario", async () => {
        const user = authenticatedUser("user-1", "user1@test.com");
        const db = user.firestore();

        await db.collection("song_stats").doc("stat-q1").set({
            user_id: "user-1",
            song_id: "song-100",
            view_count: 5
        });

        const query = db.collection("song_stats").where("user_id", "==", "user-1");
        await assertSucceeds(query.get());
    });
});

// ============================================================================
// FASE 6 - INFRAESTRUCTURA Y SEGURIDAD DE SESIONES DE DIRECTOR
// ============================================================================

describe("FASE 6 - DIRECTOR SESSIONS & ACTIVE_SESSION_ID ATOMICITY", () => {
    test("owner puede crear sesión activa y actualizar atómicamente activeSessionId en la banda", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        const db = owner.firestore();

        const batch = db.batch();
        batch.set(db.collection("bands").doc("band-1").collection("sessions").doc("sess-1"), {
            bandId: "band-1",
            directorId: "owner-1",
            directorName: "Owner User",
            setlistId: "setlist-1",
            setlistName: "Lista En Vivo",
            currentSongId: null,
            status: "active",
            startedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });
        batch.update(db.collection("bands").doc("band-1"), {
            activeSessionId: "sess-1"
        });

        await assertSucceeds(batch.commit());
    });

    test("director de la banda puede crear sesión activa y actualizar atómicamente activeSessionId", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        await owner.firestore().collection("bands").doc("band-1").collection("members").doc("director-1").set({
            role: "director",
            email: "director@test.com"
        });

        const director = authenticatedUser("director-1", "director@test.com");
        const db = director.firestore();

        const batch = db.batch();
        batch.set(db.collection("bands").doc("band-1").collection("sessions").doc("sess-2"), {
            bandId: "band-1",
            directorId: "director-1",
            directorName: "Director User",
            setlistId: "setlist-1",
            setlistName: "Lista En Vivo",
            currentSongId: null,
            status: "active",
            startedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });
        batch.update(db.collection("bands").doc("band-1"), {
            activeSessionId: "sess-2"
        });

        await assertSucceeds(batch.commit());
    });

    test("member NO puede crear una sesión de director ni actualizar activeSessionId", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        await owner.firestore().collection("bands").doc("band-1").collection("members").doc("member-1").set({
            role: "member",
            email: "member@test.com"
        });

        const member = authenticatedUser("member-1", "member@test.com");
        const db = member.firestore();

        const batch = db.batch();
        batch.set(db.collection("bands").doc("band-1").collection("sessions").doc("sess-mem"), {
            bandId: "band-1",
            directorId: "member-1",
            directorName: "Member User",
            setlistId: "setlist-1",
            setlistName: "Lista En Vivo",
            currentSongId: null,
            status: "active",
            startedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });
        batch.update(db.collection("bands").doc("band-1"), {
            activeSessionId: "sess-mem"
        });

        await assertFails(batch.commit());
    });

    test("usuario externo NO puede crear una sesión de director", async () => {
        await createBandWithOwner();
        const outsider = authenticatedUser("outsider-1", "outsider@test.com");
        const db = outsider.firestore();

        const batch = db.batch();
        batch.set(db.collection("bands").doc("band-1").collection("sessions").doc("sess-out"), {
            bandId: "band-1",
            directorId: "outsider-1",
            directorName: "Outsider User",
            setlistId: "setlist-1",
            setlistName: "Lista En Vivo",
            currentSongId: null,
            status: "active",
            startedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });
        batch.update(db.collection("bands").doc("band-1"), {
            activeSessionId: "sess-out"
        });

        await assertFails(batch.commit());
    });

    test("director NO puede crear una sesión asignando directorId ajeno", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        await owner.firestore().collection("bands").doc("band-1").collection("members").doc("director-1").set({
            role: "director",
            email: "director@test.com"
        });

        const director = authenticatedUser("director-1", "director@test.com");
        const db = director.firestore();

        const batch = db.batch();
        batch.set(db.collection("bands").doc("band-1").collection("sessions").doc("sess-spoof"), {
            bandId: "band-1",
            directorId: "owner-1", // Falsificación
            directorName: "Owner User",
            setlistId: "setlist-1",
            setlistName: "Lista En Vivo",
            currentSongId: null,
            status: "active",
            startedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });
        batch.update(db.collection("bands").doc("band-1"), {
            activeSessionId: "sess-spoof"
        });

        await assertFails(batch.commit());
    });

    test("crear sesión activa SIN actualizar activeSessionId en la banda debe fallar por regla de consistencia", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        const db = owner.firestore();

        await assertFails(
            db.collection("bands").doc("band-1").collection("sessions").doc("sess-lonely").set({
                bandId: "band-1",
                directorId: "owner-1",
                directorName: "Owner User",
                setlistId: "setlist-1",
                setlistName: "Lista En Vivo",
                currentSongId: null,
                status: "active",
                startedAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
            })
        );
    });

    test("miembro de la banda PUEDE leer las sesiones y la sesión activa", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        await owner.firestore().collection("bands").doc("band-1").collection("members").doc("member-1").set({
            role: "member",
            email: "member@test.com"
        });

        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await ctx.firestore().collection("bands").doc("band-1").collection("sessions").doc("sess-read").set({
                bandId: "band-1",
                directorId: "owner-1",
                directorName: "Owner User",
                setlistId: "setlist-1",
                setlistName: "Lista En Vivo",
                currentSongId: null,
                status: "active",
                startedAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
            });
            await ctx.firestore().collection("bands").doc("band-1").update({
                activeSessionId: "sess-read"
            });
        });

        const member = authenticatedUser("member-1", "member@test.com");
        const db = member.firestore();

        await assertSucceeds(
            db.collection("bands").doc("band-1").collection("sessions").doc("sess-read").get()
        );
        await assertSucceeds(
            db.collection("bands").doc("band-1").get()
        );
    });

    test("usuario externo NO PUEDE leer la sesión ni la banda", async () => {
        await createBandWithOwner();

        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await ctx.firestore().collection("bands").doc("band-1").collection("sessions").doc("sess-read").set({
                bandId: "band-1",
                directorId: "owner-1",
                directorName: "Owner User",
                setlistId: "setlist-1",
                setlistName: "Lista En Vivo",
                currentSongId: null,
                status: "active",
                startedAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
            });
        });

        const outsider = authenticatedUser("outsider-1", "outsider@test.com");
        const db = outsider.firestore();

        await assertFails(
            db.collection("bands").doc("band-1").collection("sessions").doc("sess-read").get()
        );
        await assertFails(
            db.collection("bands").doc("band-1").get()
        );
    });

    test("finalizar sesión actualiza a status 'ended' y limpia atómicamente activeSessionId a null", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        const db = owner.firestore();

        // Iniciar sesión
        const b1 = db.batch();
        b1.set(db.collection("bands").doc("band-1").collection("sessions").doc("sess-end"), {
            bandId: "band-1",
            directorId: "owner-1",
            directorName: "Owner User",
            setlistId: "setlist-1",
            setlistName: "Lista En Vivo",
            currentSongId: null,
            status: "active",
            startedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });
        b1.update(db.collection("bands").doc("band-1"), {
            activeSessionId: "sess-end"
        });
        await b1.commit();

        // Finalizar sesión
        const b2 = db.batch();
        b2.update(db.collection("bands").doc("band-1").collection("sessions").doc("sess-end"), {
            status: "ended",
            endedAt: new Date().toISOString()
        });
        b2.update(db.collection("bands").doc("band-1"), {
            activeSessionId: null
        });

        await assertSucceeds(b2.commit());
    });

    test("NO se puede finalizar una sesión dejando activeSessionId apuntando a ella", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        const db = owner.firestore();

        const b1 = db.batch();
        b1.set(db.collection("bands").doc("band-1").collection("sessions").doc("sess-end-fail"), {
            bandId: "band-1",
            directorId: "owner-1",
            directorName: "Owner User",
            setlistId: "setlist-1",
            setlistName: "Lista En Vivo",
            currentSongId: null,
            status: "active",
            startedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });
        b1.update(db.collection("bands").doc("band-1"), {
            activeSessionId: "sess-end-fail"
        });
        await b1.commit();

        // Intentar pasar a ended SIN limpiar activeSessionId
        await assertFails(
            db.collection("bands").doc("band-1").collection("sessions").doc("sess-end-fail").update({
                status: "ended"
            })
        );
    });

    test("NO se puede manipular directamente activeSessionId desde un usuario no autorizado", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        await owner.firestore().collection("bands").doc("band-1").collection("members").doc("member-1").set({
            role: "member",
            email: "member@test.com"
        });

        const member = authenticatedUser("member-1", "member@test.com");
        await assertFails(
            member.firestore().collection("bands").doc("band-1").update({
                activeSessionId: "hacked-session"
            })
        );
    });

    test("una sesión en estado 'ended' NO puede volver a 'active'", async () => {
        await createBandWithOwner();
        const owner = authenticatedUser("owner-1", "owner@test.com");
        const db = owner.firestore();

        // Iniciar y finalizar sesión legítimamente
        const b1 = db.batch();
        b1.set(db.collection("bands").doc("band-1").collection("sessions").doc("sess-reactivate"), {
            bandId: "band-1",
            directorId: "owner-1",
            directorName: "Owner User",
            setlistId: "setlist-1",
            setlistName: "Lista En Vivo",
            currentSongId: null,
            status: "active",
            startedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });
        b1.update(db.collection("bands").doc("band-1"), {
            activeSessionId: "sess-reactivate"
        });
        await b1.commit();

        const b2 = db.batch();
        b2.update(db.collection("bands").doc("band-1").collection("sessions").doc("sess-reactivate"), {
            status: "ended",
            endedAt: new Date().toISOString()
        });
        b2.update(db.collection("bands").doc("band-1"), {
            activeSessionId: null
        });
        await b2.commit();

        // Intentar reactivar la sesión terminada
        const b3 = db.batch();
        b3.update(db.collection("bands").doc("band-1").collection("sessions").doc("sess-reactivate"), {
            status: "active"
        });
        b3.update(db.collection("bands").doc("band-1"), {
            activeSessionId: "sess-reactivate"
        });

        await assertFails(b3.commit());
    });

    test("director de la Banda A NO puede manipular ni iniciar sesiones en la Banda B", async () => {
        await createBandWithOwner(); // Crea band-1 con owner-1
        
        // Crear band-2 con owner-2
        const owner2 = authenticatedUser("owner-2", "owner2@test.com");
        await owner2.firestore().collection("bands").doc("band-2").set({
            name: "Banda 2",
            ownerId: "owner-2"
        });
        await owner2.firestore().collection("bands").doc("band-2").collection("members").doc("owner-2").set({
            role: "owner",
            email: "owner2@test.com"
        });

        // owner-1 es director en band-1, intenta iniciar sesión en band-2
        const owner1 = authenticatedUser("owner-1", "owner@test.com");
        const db1 = owner1.firestore();

        const batch = db1.batch();
        batch.set(db1.collection("bands").doc("band-2").collection("sessions").doc("sess-cross"), {
            bandId: "band-2",
            directorId: "owner-1",
            directorName: "Attacker",
            setlistId: "setlist-1",
            setlistName: "Cross Attack",
            currentSongId: null,
            status: "active",
            startedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });
        batch.update(db1.collection("bands").doc("band-2"), {
            activeSessionId: "sess-cross"
        });

        await assertFails(batch.commit());
    });

    describe("Fase 7 - Director Session Events", () => {
        const setupActiveSession = async () => {
            await createBandWithOwner(); // band-1, owner-1
            
            // Add member-1 as regular member using admin bypass
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await context.firestore().collection("bands").doc("band-1").collection("members").doc("member-1").set({
                    role: "member",
                    email: "member@test.com"
                });
            });

            // Start active session by owner-1
            const owner1 = authenticatedUser("owner-1", "owner@test.com");
            const db = owner1.firestore();
            const batch = db.batch();
            batch.set(db.collection("bands").doc("band-1").collection("sessions").doc("sess-active"), {
                bandId: "band-1",
                directorId: "owner-1",
                directorName: "Director Owner",
                setlistId: "setlist-1",
                setlistName: "Setlist Domingo",
                currentSongId: null,
                status: "active",
                startedAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
            });
            batch.update(db.collection("bands").doc("band-1"), {
                activeSessionId: "sess-active"
            });
            await batch.commit();
        };

        test("Director de la sesión activa puede emitir eventos SONG_CHANGED, SCROLL_UP, SCROLL_DOWN", async () => {
            await setupActiveSession();

            const owner1 = authenticatedUser("owner-1", "owner@test.com");
            const db = owner1.firestore();

            const eventsRef = db.collection("bands").doc("band-1").collection("sessions").doc("sess-active").collection("events");

            await assertSucceeds(eventsRef.add({
                type: "SONG_CHANGED",
                senderId: "owner-1",
                payload: { songId: "song-123" },
                timestamp: new Date().toISOString()
            }));

            await assertSucceeds(eventsRef.add({
                type: "SCROLL_DOWN",
                senderId: "owner-1",
                payload: {},
                timestamp: new Date().toISOString()
            }));

            await assertSucceeds(eventsRef.add({
                type: "SCROLL_UP",
                senderId: "owner-1",
                payload: {},
                timestamp: new Date().toISOString()
            }));
        });

        test("Atomic write: Director puede emitir SONG_CHANGED y actualizar currentSongId de la sesión en un solo batch", async () => {
            await setupActiveSession();

            const owner1 = authenticatedUser("owner-1", "owner@test.com");
            const db = owner1.firestore();

            const sessionRef = db.collection("bands").doc("band-1").collection("sessions").doc("sess-active");
            const eventRef = sessionRef.collection("events").doc("evt-song-change");

            const batch = db.batch();
            batch.set(eventRef, {
                type: "SONG_CHANGED",
                senderId: "owner-1",
                payload: { songId: "song-456" },
                timestamp: new Date().toISOString()
            });
            batch.update(sessionRef, {
                currentSongId: "song-456"
            });

            await assertSucceeds(batch.commit());
        });

        test("Miembro NO director NO puede modificar directamente el currentSongId de la sesión", async () => {
            await setupActiveSession();

            const member1 = authenticatedUser("member-1", "member@test.com");
            const db = member1.firestore();

            const sessionRef = db.collection("bands").doc("band-1").collection("sessions").doc("sess-active");

            await assertFails(sessionRef.update({
                currentSongId: "hacked-song-id"
            }));
        });

        test("Miembro de la banda puede LEER eventos pero NO puede crear eventos", async () => {
            await setupActiveSession();

            const member1 = authenticatedUser("member-1", "member@test.com");
            const db = member1.firestore();

            const eventsRef = db.collection("bands").doc("band-1").collection("sessions").doc("sess-active").collection("events");

            // Lectura debe permitirse
            await assertSucceeds(eventsRef.get());

            // Escritura debe denegarse
            await assertFails(eventsRef.add({
                type: "SCROLL_DOWN",
                senderId: "member-1",
                payload: {},
                timestamp: new Date().toISOString()
            }));
        });

        test("Usuario no miembro NO puede leer ni crear eventos", async () => {
            await setupActiveSession();

            const stranger = authenticatedUser("stranger-uid", "stranger@test.com");
            const db = stranger.firestore();

            const eventsRef = db.collection("bands").doc("band-1").collection("sessions").doc("sess-active").collection("events");

            await assertFails(eventsRef.get());
            await assertFails(eventsRef.add({
                type: "SCROLL_DOWN",
                senderId: "stranger-uid",
                payload: {},
                timestamp: new Date().toISOString()
            }));
        });

        test("Falla la creación de evento con senderId falso, tipo inválido o payload inválido para SONG_CHANGED", async () => {
            await setupActiveSession();

            const owner1 = authenticatedUser("owner-1", "owner@test.com");
            const db = owner1.firestore();

            const eventsRef = db.collection("bands").doc("band-1").collection("sessions").doc("sess-active").collection("events");

            // SenderId suplantado
            await assertFails(eventsRef.add({
                type: "SCROLL_DOWN",
                senderId: "another-uid",
                payload: {},
                timestamp: new Date().toISOString()
            }));

            // Tipo de evento inválido
            await assertFails(eventsRef.add({
                type: "INVALID_TYPE",
                senderId: "owner-1",
                payload: {},
                timestamp: new Date().toISOString()
            }));

            // SONG_CHANGED sin songId en payload
            await assertFails(eventsRef.add({
                type: "SONG_CHANGED",
                senderId: "owner-1",
                payload: {},
                timestamp: new Date().toISOString()
            }));
        });

        test("Los eventos de sesión son inmutables (update / delete denegados)", async () => {
            await setupActiveSession();

            const owner1 = authenticatedUser("owner-1", "owner@test.com");
            const db = owner1.firestore();

            const eventsRef = db.collection("bands").doc("band-1").collection("sessions").doc("sess-active").collection("events");

            const docRef = await eventsRef.add({
                type: "SONG_CHANGED",
                senderId: "owner-1",
                payload: { songId: "song-1" },
                timestamp: new Date().toISOString()
            });

            await assertFails(docRef.update({ type: "SCROLL_DOWN" }));
            await assertFails(docRef.delete());
        });
    });
});