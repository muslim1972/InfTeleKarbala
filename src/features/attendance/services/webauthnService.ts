import { supabase } from '../../../lib/supabase';

/**
 * خدمة WebAuthn للتحقق البيومتري (البصمة)
 * تقوم بربط البصمة بالجهاز لمنع تسجيل الحضور من أجهزة أخرى
 */

// تحويل ArrayBuffer إلى Base64Url (مطلوب لـ WebAuthn)
function bufferToBase64url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let str = '';
    for (const charCode of bytes) {
        str += String.fromCharCode(charCode);
    }
    const base64String = btoa(str);
    return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// تحويل Base64Url إلى ArrayBuffer
function base64urlToBuffer(base64url: string): ArrayBuffer {
    const padding = '='.repeat((4 - base64url.length % 4) % 4);
    const base64 = (base64url + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer;
}

export interface WebAuthnCredential {
    id: string;
    credential_id: string;
    device_name: string;
    finger_label: string;
    created_at: string;
}

export const webauthnService = {
    /**
     * التحقق مما إذا كان الجهاز يدعم WebAuthn (البصمة/الوجه)
     */
    async isSupported(): Promise<boolean> {
        if (!window.PublicKeyCredential) return false;
        
        try {
            return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch (e) {
            console.error("Error checking WebAuthn support:", e);
            return false;
        }
    },

    /**
     * تسجيل بصمة جديدة وربطها بالجهاز والموظف
     */
    async register(userId: string, userEmail: string, fingerLabel: string = "إصبع أساسي", deviceName: string = "جهازي"): Promise<{ success: boolean; message: string }> {
        try {
            // 1. إنشاء Challenge عشوائي
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            // 2. إعداد خيارات التسجيل
            const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
                challenge,
                rp: {
                    name: "نظام اتصالات كربلاء",
                    id: window.location.hostname
                },
                user: {
                    id: Uint8Array.from(userId, c => c.charCodeAt(0)),
                    name: userEmail,
                    displayName: userEmail
                },
                pubKeyCredParams: [
                    { alg: -7, type: "public-key" }, // ES256
                    { alg: -257, type: "public-key" } // RS256
                ],
                authenticatorSelection: {
                    authenticatorAttachment: "platform", // يفرض استخدام بصمة الجهاز نفسه
                    userVerification: "required"
                },
                timeout: 60000,
                attestation: "none" // لا نحتاج للتحقق من نوع الجهاز بالتحديد
            };

            // 3. طلب البصمة من المستخدم
            const credential = await navigator.credentials.create({
                publicKey: publicKeyCredentialCreationOptions
            }) as PublicKeyCredential;

            if (!credential) {
                return { success: false, message: "تم إلغاء تسجيل البصمة" };
            }

            // 4. استخراج البيانات
            const response = credential.response as AuthenticatorAttestationResponse;
            const credentialId = credential.id;
            const attestationObject = bufferToBase64url(response.attestationObject);
            
            // في التطبيق الحقيقي يجب استخراج الـ publicKey من attestationObject في السيرفر
            // لكن لغرضنا هنا سنحفظ credentialId كمعرف فريد للجهاز والمفتاح
            
            // 5. الحفظ في قاعدة البيانات
            const { error } = await supabase.from('webauthn_credentials').insert({
                user_id: userId,
                credential_id: credentialId,
                public_key: attestationObject, // نحتفظ به كاملاً للمستقبل لو أردنا تحقق كامل في السيرفر
                finger_label: fingerLabel,
                device_name: deviceName,
                is_active: true
            });

            if (error) {
                if (error.code === '23505') {
                    return { success: false, message: "هذه البصمة مسجلة مسبقاً" };
                }
                throw error;
            }

            return { success: true, message: "تم تسجيل البصمة بنجاح وارتباطها بهذا الجهاز" };

        } catch (error: any) {
            console.error("Error registering biometric:", error);
            if (error.name === 'NotAllowedError') {
                return { success: false, message: "تم إلغاء العملية أو البصمة غير معرفة في الجهاز" };
            }
            return { success: false, message: error.message || "فشل تسجيل البصمة" };
        }
    },

    /**
     * التحقق من الهوية لتسجيل الحضور (فقط للأجهزة المسجلة مسبقاً)
     */
    async verify(userId: string): Promise<{ success: boolean; credentialId?: string; message: string }> {
        try {
            // 1. جلب البصمات المسجلة لهذا الموظف
            const { data: credentials, error } = await supabase
                .from('webauthn_credentials')
                .select('credential_id')
                .eq('user_id', userId)
                .eq('is_active', true);

            if (error) throw error;

            if (!credentials || credentials.length === 0) {
                return { success: false, message: "لا توجد بصمات مسجلة. يرجى تسجيل بصمتك أولاً من الإعدادات." };
            }

            // 2. إعداد Challenge عشوائي
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            // 3. تحديد الأجهزة المسموحة (allowCredentials)
            const allowCredentials = credentials.map((c: any) => ({
                type: 'public-key' as const,
                id: base64urlToBuffer(c.credential_id),
                transports: ['internal'] as AuthenticatorTransport[] // فقط الجهاز المحلي
            }));

            const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
                challenge,
                allowCredentials, // 👈 السر هنا: يطلب البصمة المربوطة بهذه المعرفات فقط
                userVerification: "required",
                timeout: 60000,
                rpId: window.location.hostname
            };

            // 4. طلب البصمة من المستخدم للتحقق
            const assertion = await navigator.credentials.get({
                publicKey: publicKeyCredentialRequestOptions
            }) as PublicKeyCredential;

            if (!assertion) {
                return { success: false, message: "تم إلغاء التحقق" };
            }

            return { 
                success: true, 
                credentialId: assertion.id,
                message: "تم التحقق بنجاح" 
            };

        } catch (error: any) {
            console.error("Error verifying biometric:", error);
            if (error.name === 'NotAllowedError') {
                return { success: false, message: "هذا الجهاز غير مسجل لتسجيل حضورك، أو تم إلغاء العملية" };
            }
            return { success: false, message: error.message || "فشل التحقق من البصمة" };
        }
    },

    /**
     * جلب قائمة البصمات المسجلة
     */
    async getCredentials(userId: string): Promise<WebAuthnCredential[]> {
        const { data, error } = await supabase
            .from('webauthn_credentials')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Error fetching credentials:", error);
            return [];
        }
        
        return data as WebAuthnCredential[];
    },

    /**
     * حذف بصمة مسجلة
     */
    async removeCredential(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('webauthn_credentials')
            .delete() // أو update is_active = false
            .eq('id', id);

        if (error) {
            console.error("Error removing credential:", error);
            return false;
        }
        return true;
    }
};
