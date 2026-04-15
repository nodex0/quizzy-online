// /admin/logout — clears the session cookie and bounces to /admin/login.

import { clearSessionCookie, requestIsSecure } from '../_lib/auth.js';

function handler({ request }) {
    const secure = requestIsSecure(request);
    return new Response(null, {
        status: 302,
        headers: {
            Location: '/admin/login',
            'Set-Cookie': clearSessionCookie({ secure })
        }
    });
}

export const onRequestGet = handler;
export const onRequestPost = handler;
