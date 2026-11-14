// faqs //
document.addEventListener('DOMContentLoaded', function() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            // Close all other open items
            faqItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            item.classList.toggle('active');
        });
    });
});



// Smooth scrolling for footer links
document.querySelectorAll('footer a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
          window.scrollTo({
              top: targetElement.offsetTop - 80,
              behavior: 'smooth'
          });
      }
  });
});
// Function to include HTML content below a specified element, id, or class
function includeHTML(url, targetElement = null) {
    fetch(url)
      .then(response => response.text())
      .then(data => {
        const parser = new DOMParser();
        const htmlContent = parser.parseFromString(data, 'text/html');
        const includedContent = htmlContent.querySelector('body').childNodes;
  
        if (targetElement) {
          const targetElementNode = typeof targetElement === 'string'
            ? document.querySelector(targetElement)
            : targetElement;
  
          includedContent.forEach(node => {
            targetElementNode.insertAdjacentElement('afterend', node.cloneNode(true));
          });
        } else {
          const firstElement = document.querySelector('body').childNodes[0];
          includedContent.forEach(node => {
            firstElement.insertAdjacentElement('beforebegin', node.cloneNode(true));
          });
        }
      })
      .catch(error => console.error('Error fetching the file:', error));
  }
  
  /* rating */
  
document.addEventListener('DOMContentLoaded', function() {
    // Get elements
    const starsContainer = document.querySelector('.rating-stars');
    const stars = starsContainer.querySelectorAll('i');
    const feedbackSection = document.querySelector('.rating-feedback');
    const thankYouMessage = document.querySelector('.thank-you-message');
    const alreadyRatedMessage = document.querySelector('.already-rated-message');
    const averageRatingEl = document.querySelector('.average-rating');
    const ratingCountEl = document.querySelector('.rating-count');
    const schemaRatingValue = document.querySelector('[itemprop="ratingValue"]');
    const schemaReviewCount = document.querySelector('[itemprop="reviewCount"]');
    const pageId = starsContainer.getAttribute('data-page-id');
    let selectedRating = 0;

    // Load all ratings from localStorage
    let allRatings = JSON.parse(localStorage.getItem('converter-ratings')) || {};

    // Initialize if no ratings exist for this page
    if (!allRatings[pageId]) {
        allRatings[pageId] = {
            totalRatings: 0,
            sumRatings: 0,
            average: 0,
            userRatings: {} // Tracks users who rated
        };
    }

    const currentPageRatings = allRatings[pageId];

    // Generate a simple user identifier (not perfect but works for static sites)
    const userKey = generateUserKey();

    // Check if user already rated
    const userAlreadyRated = currentPageRatings.userRatings[userKey];

    if (userAlreadyRated) {
        alreadyRatedMessage.classList.remove('hidden');
    } else {
        updateRatingDisplay();
    }

    // Star hover effects
    stars.forEach(star => {
        star.addEventListener('mouseover', function() {
            if (userAlreadyRated) return;
            const rating = parseInt(this.getAttribute('data-rating'));
            highlightStars(rating);
        });

        star.addEventListener('mouseout', function() {
            if (userAlreadyRated) return;
            if (selectedRating === 0) {
                resetStars();
            } else {
                highlightStars(selectedRating);
            }
        });

        star.addEventListener('click', function() {
            if (userAlreadyRated) return;
            selectedRating = parseInt(this.getAttribute('data-rating'));
            highlightStars(selectedRating);
            feedbackSection.classList.remove('hidden');
        });
    });

    // Submit rating
    document.querySelector('.submit-rating').addEventListener('click', function() {
        if (userAlreadyRated) return;

        const feedback = document.querySelector('.rating-feedback textarea').value;

        // Update ratings
        currentPageRatings.totalRatings++;
        currentPageRatings.sumRatings += selectedRating;
        currentPageRatings.average = currentPageRatings.sumRatings / currentPageRatings.totalRatings;
        currentPageRatings.userRatings[userKey] = true; // Mark user as rated

        // Save to localStorage
        localStorage.setItem('converter-ratings', JSON.stringify(allRatings));

        // Update UI
        updateRatingDisplay();

        // Show thank you message
        feedbackSection.classList.add('hidden');
        thankYouMessage.classList.remove('hidden');

        // Reset after 3 seconds
        setTimeout(() => {
            resetStars();
            document.querySelector('.rating-feedback textarea').value = '';
            thankYouMessage.classList.add('hidden');
            alreadyRatedMessage.classList.remove('hidden');
            selectedRating = 0;
        }, 3000);
    });

    // Helper functions
    function highlightStars(rating) {
        stars.forEach(star => {
            const starRating = parseInt(star.getAttribute('data-rating'));
            star.classList.toggle('hovered', starRating <= rating);
        });
    }

    function resetStars() {
        stars.forEach(star => star.classList.remove('hovered'));
    }

    function updateRatingDisplay() {
        averageRatingEl.textContent = currentPageRatings.average.toFixed(1);
        ratingCountEl.textContent = currentPageRatings.totalRatings;
        
        // Update Schema.org for SEO
        schemaRatingValue.content = currentPageRatings.average.toFixed(1);
        schemaReviewCount.content = currentPageRatings.totalRatings;
    }

    // Simple user fingerprinting (combines browser info)
    function generateUserKey() {
        return [
            navigator.userAgent,
            new Date().getTimezoneOffset(),
            navigator.language,
            (window.screen.width || '') + 'x' + (window.screen.height || ''),
            pageId // Include pageId to make it unique per converter
        ].join('|');
    }
});

