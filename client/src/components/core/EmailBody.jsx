/* src/components/specific/EmailBody.jsx (Final, Corrected Version) */

import React from 'react';
import sanitizeHtml from 'sanitize-html'; // Correct way to import

// --- HELPER FUNCTIONS ---
// These functions are specific to rendering email bodies, so it's good to keep them here.

const convertCidToDataUri = (html, attachments) => {
    if (!html || !attachments || attachments.length === 0) return html;
    
    let modifiedHtml = html;
    // Regex to find all cid: sources
    const cidRegex = /src="cid:([^"]+)"/g;
    let match;
    
    while ((match = cidRegex.exec(html)) !== null) {
        const cid = match[1];
        // Find the corresponding attachment by its contentId
        const attachment = attachments.find(att => att.contentId === cid);
        
        if (attachment && attachment.data) {
            const dataUri = `data:${attachment.contentType};base64,${attachment.data}`;
            // Replace the cid: link with the full Base64 data URI
            modifiedHtml = modifiedHtml.replace(`src="cid:${cid}"`, `src="${dataUri}"`);
        }
    }
    return modifiedHtml;
};

const sanitizeEmailHtml = (dirtyHtml) => {
    // This is a very permissive set of rules for maximum compatibility, which is fine.
    // In a high-security environment, you might tighten these rules.
    return sanitizeHtml(dirtyHtml, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
            'html', 'body', 'head', 'style', 'meta', 'title', 'img', 'table', 'thead', 'tbody',
            'tfoot', 'tr', 'th', 'td', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'pre', 'code', 'blockquote', 'center', 'font'
        ]),
        allowedAttributes: false, // Allows all attributes, a bit risky but good for compatibility
        allowedSchemes: ['http', 'https', 'ftp', 'mailto', 'tel', 'data', 'cid'],
        allowedSchemesByTag: { 'img': ['data', 'cid', 'http', 'https'] },
        allowVulnerableTags: true,
        transformTags: { 'a': sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }) },
    });
};


const EmailBody = ({ htmlContent, attachments }) => {
    // Inject CSS to ensure a baseline level of responsiveness and proper text color.
    const overrideCss = `
        <style>
            /* --- RESPONSIVENESS (Existing) --- */
            .email-content-container, .email-content-container * {
                max-width: 100% !important;
                box-sizing: border-box;
                word-break: break-word;
            }
            .email-content-container img, 
            .email-content-container video, 
            .email-content-container object {
                height: auto !important;
            }
            .email-content-container table {
                width: 100% !important;
            }
            
            /* --- THE FIX: COLOR OVERRIDE --- */
            /* 1. Set a sane, dark default text color for the entire container. */
            .email-content-container {
                color: #1f2937; /* A dark gray, similar to Tailwind's gray-800 */
            }

            /* 2. Force common text elements to inherit this color. 
                  The !important is crucial to override inline styles like style="color: #ffffff". */
            .email-content-container span,
            .email-content-container div,
            .email-content-container li,
            .email-content-container td,
            .email-content-container h1,
            .email-content-container h2,
            .email-content-container h3 {
                color: inherit ;
            }

        </style>
    `;

    let processedHtml = htmlContent || '';
    processedHtml = convertCidToDataUri(processedHtml, attachments);
    processedHtml = sanitizeEmailHtml(processedHtml);
    
    // Prepend our override CSS to the sanitized HTML.
    const finalHtml = overrideCss + processedHtml;

    return (
        <div
            className="p-8 email-content-container" 
            dangerouslySetInnerHTML={{ __html: finalHtml }}
        />
    );
};

export default EmailBody;