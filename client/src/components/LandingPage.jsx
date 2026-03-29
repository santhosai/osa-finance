import { useState } from 'react';

function LandingPage() {
  const [hoveredService, setHoveredService] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const services = [
    {
      icon: '💰',
      title: 'Weekly Loans',
      desc: 'Quick weekly loans with easy 10-week repayment. Sunday & Thursday collections available.',
      color: '#3b82f6'
    },
    {
      icon: '📅',
      title: 'Monthly Loans',
      desc: 'Flexible monthly loan options with convenient monthly repayment schedules.',
      color: '#8b5cf6'
    },
    {
      icon: '🎯',
      title: 'Chit Fund',
      desc: 'Trusted chit fund management with transparent monthly collections and payouts.',
      color: '#ec4899'
    },
    {
      icon: '🚗',
      title: 'Auto Finance',
      desc: 'Vehicle loans with easy EMI options for two-wheelers and four-wheelers.',
      color: '#0d9488'
    },
    {
      icon: '💳',
      title: 'Aadhar Banking',
      desc: 'Cash withdrawal and deposit using Aadhar card. No bank visit needed.',
      color: '#f59e0b'
    },
    {
      icon: '📱',
      title: 'Bill Payments',
      desc: 'Pay all your bills — DTH, Electricity, Mobile Recharge, Gas and more at one place.',
      color: '#ef4444'
    },
    {
      icon: '💸',
      title: 'Money Transfer',
      desc: 'Instant money transfer to any bank account. Safe, fast and reliable.',
      color: '#10b981'
    },
    {
      icon: '🏦',
      title: 'ATM / Card Services',
      desc: 'Credit & debit card cash withdrawal services available at our center.',
      color: '#6366f1'
    }
  ];

  const stats = [
    { number: '500+', label: 'Happy Customers' },
    { number: '10+', label: 'Years Experience' },
    { number: '₹1Cr+', label: 'Loans Disbursed' },
    { number: '24/7', label: 'Customer Support' }
  ];

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <div style={{
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      color: '#1e293b',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      minHeight: '100vh',
      margin: 0,
      padding: 0,
      overflowX: 'hidden',
      overflowY: 'auto',
      zIndex: 9999,
      background: '#0f172a'
    }}>
      {/* Navbar */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 1000,
        boxShadow: '0 2px 20px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 800,
            color: '#0f172a'
          }}>
            O
          </div>
          <div>
            <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: '16px', lineHeight: 1.2 }}>
              OM SAI MURUGAN
            </div>
            <div style={{ color: '#94a3b8', fontSize: '10px', letterSpacing: '2px' }}>
              FINANCE
            </div>
          </div>
        </div>

        {/* Desktop Nav */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}
          className="desktop-nav"
        >
          {['Home', 'Services', 'About', 'Contact'].map(item => (
            <span
              key={item}
              onClick={() => scrollToSection(item.toLowerCase())}
              style={{
                color: '#cbd5e1',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'color 0.2s'
              }}
              onMouseEnter={e => e.target.style.color = '#f59e0b'}
              onMouseLeave={e => e.target.style.color = '#cbd5e1'}
            >
              {item}
            </span>
          ))}
          <a
            href="/balance-check"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#0f172a',
              padding: '8px 20px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              textDecoration: 'none',
              transition: 'transform 0.2s'
            }}
          >
            Check Balance
          </a>
        </div>

        {/* Mobile Menu Button */}
        <div
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ cursor: 'pointer', fontSize: '24px', color: 'white', display: 'none' }}
          className="mobile-menu-btn"
        >
          {menuOpen ? '✕' : '☰'}
        </div>
      </nav>

      {/* Mobile Menu */}
      {menuOpen && (
        <div style={{
          position: 'fixed',
          top: '64px',
          left: 0,
          right: 0,
          background: 'rgba(15, 23, 42, 0.98)',
          padding: '20px',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {['Home', 'Services', 'About', 'Contact'].map(item => (
            <span
              key={item}
              onClick={() => scrollToSection(item.toLowerCase())}
              style={{ color: '#cbd5e1', fontSize: '18px', cursor: 'pointer', padding: '8px 0' }}
            >
              {item}
            </span>
          ))}
          <a href="/balance-check" style={{
            background: '#f59e0b', color: '#0f172a', padding: '12px', borderRadius: '8px',
            fontWeight: 700, textAlign: 'center', textDecoration: 'none'
          }}>
            Check Balance
          </a>
        </div>
      )}

      {/* Hero Section */}
      <section id="home" style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '100px 20px 60px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background decoration */}
        <div style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)',
          top: '10%',
          right: '10%',
          borderRadius: '50%'
        }} />
        <div style={{
          position: 'absolute',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
          bottom: '10%',
          left: '10%',
          borderRadius: '50%'
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px' }}>
          <div style={{
            fontSize: '14px',
            color: '#f59e0b',
            fontWeight: 600,
            letterSpacing: '4px',
            marginBottom: '20px',
            textTransform: 'uppercase'
          }}>
            Trusted Since 2015
          </div>
          <h1 style={{
            fontSize: 'clamp(32px, 6vw, 56px)',
            fontWeight: 900,
            color: 'white',
            lineHeight: 1.2,
            margin: '0 0 16px'
          }}>
            OM SAI MURUGAN
          </h1>
          <h2 style={{
            fontSize: 'clamp(20px, 4vw, 32px)',
            fontWeight: 300,
            color: '#94a3b8',
            margin: '0 0 32px',
            letterSpacing: '6px'
          }}>
            FINANCE
          </h2>
          <p style={{
            fontSize: '18px',
            color: '#94a3b8',
            maxWidth: '600px',
            margin: '0 auto 40px',
            lineHeight: 1.8
          }}>
            Your trusted financial partner for loans, banking services, bill payments and more.
            Serving the community with transparency and trust.
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://wa.me/918667510724?text=Hi%2C%20I%20need%20information%20about%20loan%20services"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'linear-gradient(135deg, #25d366, #128c7e)',
                color: 'white',
                padding: '16px 32px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '16px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 8px 25px rgba(37,211,102,0.3)',
                transition: 'transform 0.2s'
              }}
            >
              WhatsApp Us
            </a>
            <a
              href="tel:+918667510724"
              style={{
                background: 'transparent',
                color: '#f59e0b',
                padding: '16px 32px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '16px',
                textDecoration: 'none',
                border: '2px solid #f59e0b',
                transition: 'all 0.2s'
              }}
            >
              Call Now
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        padding: '40px 20px',
        display: 'flex',
        justifyContent: 'center',
        gap: '40px',
        flexWrap: 'wrap'
      }}>
        {stats.map((stat, i) => (
          <div key={i} style={{ textAlign: 'center', minWidth: '120px' }}>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#0f172a' }}>{stat.number}</div>
            <div style={{ fontSize: '14px', color: '#451a03', fontWeight: 600 }}>{stat.label}</div>
          </div>
        ))}
      </section>

      {/* Services */}
      <section id="services" style={{
        padding: '80px 20px',
        background: '#f8fafc',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{
            fontSize: '13px',
            color: '#f59e0b',
            fontWeight: 700,
            letterSpacing: '3px',
            marginBottom: '12px',
            textTransform: 'uppercase'
          }}>
            What We Offer
          </div>
          <h2 style={{
            fontSize: 'clamp(24px, 4vw, 36px)',
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: '48px'
          }}>
            Our Services
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '24px'
          }}>
            {services.map((service, i) => (
              <div
                key={i}
                onMouseEnter={() => setHoveredService(i)}
                onMouseLeave={() => setHoveredService(null)}
                style={{
                  background: 'white',
                  padding: '32px 24px',
                  borderRadius: '16px',
                  boxShadow: hoveredService === i
                    ? `0 20px 40px ${service.color}20`
                    : '0 4px 12px rgba(0,0,0,0.06)',
                  transform: hoveredService === i ? 'translateY(-8px)' : 'translateY(0)',
                  transition: 'all 0.3s ease',
                  cursor: 'default',
                  borderTop: `4px solid ${service.color}`,
                  textAlign: 'left'
                }}
              >
                <div style={{
                  fontSize: '40px',
                  marginBottom: '16px'
                }}>
                  {service.icon}
                </div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#0f172a',
                  marginBottom: '8px'
                }}>
                  {service.title}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#64748b',
                  lineHeight: 1.7,
                  margin: 0
                }}>
                  {service.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" style={{
        padding: '80px 20px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: 'white'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            fontSize: '13px',
            color: '#f59e0b',
            fontWeight: 700,
            letterSpacing: '3px',
            marginBottom: '12px',
            textTransform: 'uppercase'
          }}>
            About Us
          </div>
          <h2 style={{
            fontSize: 'clamp(24px, 4vw, 36px)',
            fontWeight: 800,
            marginBottom: '32px'
          }}>
            Why Choose Us?
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '24px',
            textAlign: 'left'
          }}>
            {[
              { icon: '🤝', title: 'Trust & Transparency', desc: 'Clear terms, no hidden charges. We believe in honest business.' },
              { icon: '⚡', title: 'Quick Processing', desc: 'Fast loan approval and disbursement. Get funds when you need them.' },
              { icon: '📞', title: 'Personal Service', desc: 'Direct contact with us. No call centers, no waiting — talk to us directly.' },
              { icon: '🔒', title: 'Safe & Secure', desc: 'Your data and money are protected. Licensed and regulated services.' },
              { icon: '🏘️', title: 'Community First', desc: 'Proudly serving Peddur, Alangayam and surrounding areas for over 10 years.' },
              { icon: '💼', title: 'All-in-One Center', desc: 'Loans, banking, bill payments — all financial services under one roof.' }
            ].map((item, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '24px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>{item.icon}</div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: '#f59e0b' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" style={{
        padding: '80px 20px',
        background: '#f8fafc',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{
            fontSize: '13px',
            color: '#f59e0b',
            fontWeight: 700,
            letterSpacing: '3px',
            marginBottom: '12px',
            textTransform: 'uppercase'
          }}>
            Get In Touch
          </div>
          <h2 style={{
            fontSize: 'clamp(24px, 4vw, 36px)',
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: '48px'
          }}>
            Contact Us
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '24px'
          }}>
            {/* Address */}
            <div style={{
              background: 'white',
              padding: '32px',
              borderRadius: '16px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
            }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📍</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: '#0f172a' }}>
                Our Office
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.8, margin: 0 }}>
                9, Kovil Street<br />
                Peddur, Alangayam<br />
                Pin - 635701
              </p>
            </div>

            {/* Phone */}
            <div style={{
              background: 'white',
              padding: '32px',
              borderRadius: '16px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
            }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📞</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: '#0f172a' }}>
                Call Us
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <a href="tel:+918667510724" style={{
                  fontSize: '16px', color: '#3b82f6', fontWeight: 600, textDecoration: 'none'
                }}>
                  8667 510 724
                </a>
                <a href="tel:+919629539071" style={{
                  fontSize: '16px', color: '#3b82f6', fontWeight: 600, textDecoration: 'none'
                }}>
                  9629 539 071
                </a>
              </div>
            </div>

            {/* WhatsApp */}
            <div style={{
              background: 'white',
              padding: '32px',
              borderRadius: '16px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
            }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>💬</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: '#0f172a' }}>
                WhatsApp
              </h3>
              <a
                href="https://wa.me/918667510724?text=Hi%2C%20I%20need%20information%20about%20your%20services"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #25d366, #128c7e)',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '14px',
                  textDecoration: 'none'
                }}
              >
                Message Us
              </a>
            </div>
          </div>

          {/* Google Maps */}
          <div style={{
            marginTop: '40px',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <iframe
              title="Office Location"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3883.5!2d78.75!3d12.62!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sPeddur%2C%20Alangayam%2C%20Tamil%20Nadu%20635701!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
              width="100%"
              height="300"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      {/* Quick Links Bar */}
      <section style={{
        background: 'linear-gradient(135deg, #1e40af, #1e3a8a)',
        padding: '40px 20px',
        textAlign: 'center'
      }}>
        <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>
          Existing Customer?
        </h3>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/balance-check" style={{
            background: 'white',
            color: '#1e40af',
            padding: '14px 32px',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '15px',
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}>
            Check Loan Balance
          </a>
          <a
            href="https://wa.me/918667510724?text=Hi%2C%20I%20want%20to%20check%20my%20loan%20details"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'transparent',
              color: 'white',
              padding: '14px 32px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '15px',
              textDecoration: 'none',
              border: '2px solid white'
            }}
          >
            Contact Support
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        background: '#0f172a',
        padding: '40px 20px',
        textAlign: 'center',
        color: '#64748b'
      }}>
        <div style={{
          color: '#f59e0b',
          fontWeight: 800,
          fontSize: '20px',
          marginBottom: '8px'
        }}>
          OM SAI MURUGAN FINANCE
        </div>
        <p style={{ fontSize: '13px', marginBottom: '20px', lineHeight: 1.8 }}>
          9, Kovil Street, Peddur, Alangayam - 635701
        </p>
        <div style={{
          fontSize: '12px',
          borderTop: '1px solid #1e293b',
          paddingTop: '20px'
        }}>
          &copy; {new Date().getFullYear()} Om Sai Murugan Finance. All rights reserved.
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/918667510724"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '60px',
          height: '60px',
          background: '#25d366',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          boxShadow: '0 4px 20px rgba(37,211,102,0.4)',
          zIndex: 999,
          textDecoration: 'none',
          transition: 'transform 0.3s'
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        💬
      </a>

      {/* CSS for responsive */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
        @media (min-width: 769px) {
          .desktop-nav { display: flex !important; }
          .mobile-menu-btn { display: none !important; }
        }
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
}

export default LandingPage;
