document.addEventListener('DOMContentLoaded', function() {
    // Array of blog posts with their metadata
    const blogPosts = [
        {
            title: "Converting PNG to WebP: A Complete Guide",
            excerpt: "Learn how to convert PNG images to WebP format to improve your website's performance and reduce loading times.",
            date: "November 15, 2023",
            author: "Jane Doe",
            category: "Web Optimization",
            image: "https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=80",
            url: "post1"
        },
        
        // Add more posts as needed
    ];

    // Function to display blog posts
    function displayBlogPosts(posts) {
        const postsContainer = document.getElementById('blogPosts');
        postsContainer.innerHTML = ''; // Clear loading message

        if (posts.length === 0) {
            postsContainer.innerHTML = '<div class="no-posts">No blog posts found.</div>';
            return;
        }

        posts.forEach(post => {
            const postElement = document.createElement('article');
            postElement.className = 'blog-post';
            
            postElement.innerHTML = `
                <img src="${post.image}" alt="${post.title}" class="post-image">
                <div class="post-content">
                    <h2 class="post-title">${post.title}</h2>
                    <div class="post-meta">
                        <span><i class="fas fa-calendar-alt"></i> ${post.date}</span>
                        <span><i class="fas fa-user"></i> ${post.author}</span>
                        <span><i class="fas fa-tag"></i> ${post.category}</span>
                    </div>
                    <p class="post-excerpt">${post.excerpt}</p>
                    <a href="${post.url}" class="read-more">Read More</a>
                </div>
            `;
            
            postsContainer.appendChild(postElement);
        });
    }

    // Initialize the blog
    displayBlogPosts(blogPosts);

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');

    if (searchButton && searchInput) {
        searchButton.addEventListener('click', function() {
            const searchTerm = searchInput.value.toLowerCase();
            const filteredPosts = blogPosts.filter(post => 
                post.title.toLowerCase().includes(searchTerm) || 
                post.excerpt.toLowerCase().includes(searchTerm) ||
                post.category.toLowerCase().includes(searchTerm)
            );
            displayBlogPosts(filteredPosts);
        });

        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchButton.click();
            }
        });
    }
});