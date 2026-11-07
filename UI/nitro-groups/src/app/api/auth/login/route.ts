import { NextRequest, NextResponse } from "next/server";
import { resolveBackendApiBaseUrl } from "@/lib/backendBaseUrl";
import { getSessionSecret } from "@/lib/sessionSecret";
import { sessionUserType } from "@/lib/sessionUserType";

interface LoginRequest {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    userType?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: LoginRequest = await request.json();
        const { email, password, firstName: bodyFirstName, lastName: bodyLastName, userType: bodyUserType } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email y contraseña son requeridos" },
                { status: 400 }
            );
        }

        const auth0Domain = process.env.AUTH0_DOMAIN;
        const clientId = process.env.AUTH0_CLIENT_ID;
        const clientSecret = process.env.AUTH0_CLIENT_SECRET;
        const audience = process.env.AUTH0_AUDIENCE;

        if (!auth0Domain || !clientId || !clientSecret) {
            console.error("Missing Auth0 configuration");
            return NextResponse.json(
                { error: "Error de configuración del servidor" },
                { status: 500 }
            );
        }

        // Sin audience, Auth0 puede emitir un access_token que NO es para la API .NET → 401 en /api/users/...
        if (!audience?.trim()) {
            console.error("AUTH0_AUDIENCE is required (must match Auth0:Audience / user-secrets en NitroGroups.Services.Api)");
            return NextResponse.json(
                { error: "Error de configuración del servidor (AUTH0_AUDIENCE)" },
                { status: 500 }
            );
        }

        // Call Auth0 Resource Owner Password Grant
        const tokenResponse = await fetch(`https://${auth0Domain}/oauth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "http://auth0.com/oauth/grant-type/password-realm",
                username: email,
                password: password,
                client_id: clientId,
                client_secret: clientSecret,
                audience: audience,
                realm: process.env.AUTH0_DB_CONNECTION || "Username-Password-Authentication",
                scope: "openid profile email offline_access",
            }),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            let errorMessage = "Credenciales inválidas";

            if (tokenData.error === "invalid_grant") {
                errorMessage = "Email o contraseña incorrectos";
            } else if (tokenData.error === "too_many_attempts") {
                errorMessage = "Demasiados intentos. Intenta más tarde";
            } else if (tokenData.error_description) {
                errorMessage = tokenData.error_description;
            }

            return NextResponse.json(
                { error: errorMessage },
                { status: 401 }
            );
        }

        // Decode the ID token to get user info
        const idTokenPayload = JSON.parse(
            Buffer.from(tokenData.id_token.split(".")[1], "base64url").toString()
        );

        // Build session data
        // Use firstName/lastName from signup form if available (Auth0 id_token may not have them for new users)
        const resolvedFirstName = bodyFirstName || idTokenPayload.given_name || "";
        const resolvedLastName = bodyLastName || idTokenPayload.family_name || "";
        const resolvedName = (resolvedFirstName && resolvedLastName)
            ? `${resolvedFirstName} ${resolvedLastName}`
            : idTokenPayload.name || idTokenPayload.email;

        const sessionData = {
            user: {
                sub: idTokenPayload.sub,
                email: idTokenPayload.email,
                name: resolvedName,
                given_name: resolvedFirstName,
                family_name: resolvedLastName,
                picture: idTokenPayload.picture,
                email_verified: idTokenPayload.email_verified,
                nickname: idTokenPayload.nickname,
            },
            accessToken: tokenData.access_token,
            idToken: tokenData.id_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: Math.floor(Date.now() / 1000) + tokenData.expires_in,
        };

        // Sync user to PostgreSQL database (non-blocking)
        const backendUrl = resolveBackendApiBaseUrl();
        try {
            // Use resolved names from signup body or id_token
            const rawType = bodyUserType
                || idTokenPayload["https://nitrogroups.com/user_metadata"]?.user_type
                || idTokenPayload.user_metadata?.user_type
                || "client";
            // "band_member" es solo el flujo de onboarding de manager: la cuenta es de músico.
            const userTypeMap: Record<string, number> = {
                client: 0,
                musician: 1,
                band_member: 1,
            };
            const mappedType = userTypeMap[rawType] ?? 0;

            const firstName = resolvedFirstName || idTokenPayload.email.split("@")[0];
            const lastName = resolvedLastName || ".";

            const syncResponse = await fetch(`${backendUrl}/auth/sync`, {
                method: "POST",
                // La API toma la identidad del access token, no del body.
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokenData.access_token}`,
                },
                body: JSON.stringify({
                    auth0Id: idTokenPayload.sub,
                    email: idTokenPayload.email,
                    firstName,
                    lastName,
                    userType: mappedType,
                    profilePictureUrl: idTokenPayload.picture || null,
                    origin: "signup",
                }),
            });

            if (!syncResponse.ok) {
                const syncError = await syncResponse.text();
                console.error("User sync failed:", syncResponse.status, syncError);
            } else {
                // The backend answers with the stored user: its type decides where /dashboard sends them.
                // Without this every login landed on the musician dashboard, clients included.
                const synced = (await syncResponse.json().catch(() => null)) as { userType?: unknown } | null;
                const type = sessionUserType(synced?.userType);
                if (type) Object.assign(sessionData.user, { user_type: type });
            }
        } catch (syncError) {
            console.error("User sync error (non-blocking):", syncError);
        }


        // Create response with session cookie
        const response = NextResponse.json({
            success: true,
            user: sessionData.user,
        });

        // Encrypt and set session cookie
        const { SignJWT } = await import("jose");
        const secret = getSessionSecret();

        const jwt = await new SignJWT({ session: sessionData })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("7d")
            .sign(secret);

        response.cookies.set("nitro_session", jwt, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return response;
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
