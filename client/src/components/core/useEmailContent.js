import { useEffect, useState } from 'react';
import * as sanitizeHtml from 'sanitize-html';

export const useEmailContent = (email) => {
  const [contentToDisplay, setContentToDisplay] = useState('');
  const [isHtml, setIsHtml] = useState(false);

  useEffect(() => {
    if (!email) {
      setContentToDisplay('');
      return;
    }

    let bodyContent = email.body || '';
    let isBodyHtml = email.isHtml || false;

    // Check for a multipart structure
    if (email.parts && Array.isArray(email.parts)) {
      const htmlPart = email.parts.find(part => part.contentType && part.contentType.includes('text/html'));
      const textPart = email.parts.find(part => part.contentType && part.contentType.includes('text/plain'));

      if (htmlPart) {
        // Sanitize HTML to prevent XSS attacks
        // You can customize allowedTags and attributes as needed
        bodyContent = sanitizeHtml(htmlPart.content, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'style']),
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            a: ['href', 'name', 'target'],
            img: ['src', 'alt', 'width', 'height']
          },
          transformTags: {
            'a': sanitizeHtml.simpleTransform('a', {
              target: '_blank',
              rel: 'noopener noreferrer'
            })
          }
        });
        isBodyHtml = true;
      } else if (textPart) {
        bodyContent = textPart.content;
        isBodyHtml = false;
      }
    }

    setContentToDisplay(bodyContent);
    setIsHtml(isBodyHtml);
  }, [email]);

  return { contentToDisplay, isHtml };
};