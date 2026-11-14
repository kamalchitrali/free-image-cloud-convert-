document.addEventListener('DOMContentLoaded', function() {
    const mobileMenu = document.querySelector('.mobile-menu');
    const nav = document.querySelector('nav');
    const navLinks = document.querySelectorAll('nav ul li a');
  
    // Toggle mobile menu
    mobileMenu.addEventListener('click', () => {
      nav.classList.toggle('active');
      mobileMenu.classList.toggle('active');
    });
  
    // Handle dropdown menus on mobile
    navLinks.forEach(link => {
      if (link.nextElementSibling && link.nextElementSibling.tagName === 'UL') {
        link.addEventListener('click', (e) => {
          if (window.innerWidth <= 992) {
            e.preventDefault();
            const parentLi = link.parentElement;
            parentLi.classList.toggle('menu-open');
            link.nextElementSibling.style.display = 
              link.nextElementSibling.style.display === 'block' ? 'none' : 'block';
          }
        });
      }
    });
  
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target) && !mobileMenu.contains(e.target)) {
        nav.classList.remove('active');
        mobileMenu.classList.remove('active');
      }
    });
  
    // Close menu on resize
    window.addEventListener('resize', () => {
      if (window.innerWidth > 992) {
        nav.classList.remove('active');
        mobileMenu.classList.remove('active');
      }
    });
  });

  // Contact 
  document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form values
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const subject = document.getElementById('subject').value;
            const message = document.getElementById('message').value;
            
            // Here you would typically send the data to a server
            console.log('Form submitted:', { name, email, subject, message });
            
            // Show success message
            alert('Thank you for your message! We will get back to you soon.');
            
            // Reset form
            contactForm.reset();
        });
    }
});


// about us 

document.addEventListener('DOMContentLoaded', function() {
    // Animation on scroll for about page sections
    const animateOnScroll = function() {
        const elements = document.querySelectorAll('.mission-section .container, .team-section .container, .stats-section .container, .values-section .container, .cta-section .container');
        
        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            
            if (elementPosition < windowHeight - 100) {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }
        });
    };

    // Set initial state for animations
    const animatedElements = document.querySelectorAll('.mission-section .container, .team-section .container, .stats-section .container, .values-section .container, .cta-section .container');
    animatedElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    });

    // Run once on load
    animateOnScroll();
    
    // Run on scroll
    window.addEventListener('scroll', animateOnScroll);
});

