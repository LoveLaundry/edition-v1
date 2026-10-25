import {
    RiCalendarCheckLine,
    RiTruckLine,
    RiSparklingLine,
    RiHomeSmileLine,
    RiShoppingBasket2Line,
    RiStarFill,
    RiTimeLine,
    RiShieldCheckLine,
    RiHeart3Fill,
    RiHotelLine,
    RiBuildingLine,
    RiScales3Line,
    RiUserStarLine,
    RiMoneyRupeeCircleLine,
    RiTeamLine,
    RiAwardLine,
} from "react-icons/ri";
import type { IconType } from "react-icons";

import { COMPANY } from "./constants";

// Re-export for backward compatibility
export const companyInfo = {
    name: COMPANY.name,
    tagline: COMPANY.tagline,
    description: COMPANY.description,
    phone: COMPANY.phoneFull,
    whatsapp: COMPANY.whatsappFull,
    email: COMPANY.email,
    address: COMPANY.address.full,
    rating: COMPANY.stats.rating,
    serviceCount: COMPANY.stats.serviceCount,
    availability: COMPANY.stats.availability,
    customerCount: COMPANY.stats.customerCount,
};

// Hero Section Data
export const heroData = {
    badge: {
        icon: RiHeart3Fill,
        text: "Professional Laundry Service",
    },
    title: {
        main: "Fresh clothes.",
        highlight: "More free time.",
    },
    description:
        "Professional laundry care with doorstep pickup & delivery.",
    buttons: {
        primary: {
            text: "Book a Pickup",
            scrollTo: "contact",
        },
        secondary: {
            text: "Explore Services",
            scrollTo: "services",
        },
    },
    stats: [
        {
            icon: RiShoppingBasket2Line,
            value: companyInfo.serviceCount,
            label: "Services",
        },
        {
            icon: RiStarFill,
            value: companyInfo.rating,
            label: "Customer rating",
        },
        {
            icon: RiTimeLine,
            value: companyInfo.availability,
            label: "Convenience",
        },
    ],
    image: {
        src: "./assets/images/love-laundry-hero.png",
        alt: "Love Laundry pickup and laundry service",
    },
    badge_text: {
        primary: "Love Laundry",
        secondary: "Schedule yours today",
    },
};

// Services Section Data
export interface Service {
    title: string;
    subtitle: string;
    description: string;
    image: string;
}

export const services: Service[] = [
    {
        title: "Wash & Fold",
        subtitle: "Everyday Laundry",
        description:
            "Professional washing, drying and folding for your everyday clothes.",
        image: "./assets/images/services/wash-fold.jpg",
    },
    {
        title: "Ironing",
        subtitle: "Crisp & Perfect",
        description:
            "Freshly pressed clothes that look clean, sharp and ready to wear.",
        image: "./assets/images/services/ironing.jpg",
    },
    {
        title: "Dry Cleaning",
        subtitle: "Special Care",
        description:
            "Specialized cleaning for suits, dresses and delicate garments.",
        image: "./assets/images/services/dry-cleaning.jpg",
    },
    {
        title: "Pickup & Delivery",
        subtitle: "At Your Door",
        description:
            "We collect your laundry and return it fresh and ready to wear.",
        image: "./assets/images/services/pickup-delivery.jpg",
    },
];

export const servicesSection = {
    badge: "Our Services",
    title: {
        main: "Everything your",
        highlight: "clothes need.",
    },
    description: "",
    cta: {
        text: "Not sure which service you need?",
        subtext: "Talk to our team and we'll help you choose.",
        buttonText: "Contact Us",
    },
};

// Commercial/Hotel Services Section Data
export interface CommercialService {
    icon: IconType;
    title: string;
    subtitle: string;
    description: string;
    features: string[];
}

export const commercialServices: CommercialService[] = [
    {
        icon: RiHotelLine,
        title: "Hotel Linen Service",
        subtitle: "Luxury Standards",
        description:
            "Professional bulk linen washing for hotels, guest houses, and resorts. We maintain the highest hygiene standards.",
        features: [
            "Bed sheets & pillowcases",
            "Towels & bathrobes",
            "Table linens",
            "Curtains & duvets",
        ],
    },
    {
        icon: RiBuildingLine,
        title: "Commercial Laundry",
        subtitle: "Business Solutions",
        description:
            "Reliable laundry services for restaurants, spas, salons, gyms, and medical facilities with flexible scheduling.",
        features: [
            "Restaurant linens",
            "Spa & salon towels",
            "Gym towels & uniforms",
            "Medical facility linens",
        ],
    },
    {
        icon: RiScales3Line,
        title: "Bulk Processing",
        subtitle: "High Volume Care",
        description:
            "Large-scale laundry processing with quick turnaround times. Perfect for businesses with regular high-volume needs.",
        features: [
            "Daily/weekly pickup",
            "Fast turnaround time",
            "Dedicated account manager",
            "Competitive bulk pricing",
        ],
    },
];

export const commercialSection = {
    badge: "Commercial Services",
    title: {
        main: "Professional linen care for",
        highlight: "hotels & businesses.",
    },
    description:
        "Bulk washing and specialty care for hotels, restaurants, spas and businesses.",
    cta: {
        text: "Need commercial laundry solutions?",
        subtext: "Get a custom quote for your business needs.",
        buttonText: "Request Quote",
    },
};

// Partners Section Data
export interface Partner {
    name: string;
    image: string;
    description: string;
    years: number;
    location: string;
}

export const partnersSection = {
    badge: "Our Partners",
    title: {
        main: "Trusted by leading",
        highlight: "hotels & resorts.",
    },
    description:
        "We provide professional linen and laundry care for hotels, resorts and villas across Sri Lanka.",
    partners: [
        {
            name: "Goldi Sands Hotel",
            image: "./assets/images/partners/goldi-sands.jpg",
            description:
                "A beachfront hotel in Negombo offering comfortable rooms and direct access to the golden sands of the Indian Ocean.",
            years: 3,
            location: "Negombo",
        },
        {
            name: "Carolina Beach Resort",
            image: "./assets/images/partners/carolina-beach.jpg",
            description:
                "A tropical beach resort along the west coast, known for its serene atmosphere and warm hospitality.",
            years: 2,
            location: "Negombo",
        },
        {
            name: "Suriya Resort",
            image: "./assets/images/partners/suriya-resort.jpg",
            description:
                "A boutique resort offering a peaceful retreat with lush gardens and modern amenities.",
            years: 2,
            location: "Negombo",
        },
        {
            name: "Amagi Resort",
            image: "./assets/images/partners/amagi-resort.jpg",
            description:
                "A 4-star hotel group with properties near the Negombo Lagoon, offering panoramic views and refined accommodation.",
            years: 3,
            location: "Negombo",
        },
        {
            name: "Avenra Garden",
            image: "./assets/images/partners/avenra-garden.jpg",
            description:
                "A luxury hotel offering stylish rooms, exquisite dining, and exceptional service in the heart of Negombo.",
            years: 2,
            location: "Negombo",
        },
        {
            name: "1.2.3 Villa",
            image: "./assets/images/partners/123-villa.jpg",
            description:
                "A private villa accommodation offering a home-away-from-home experience with personalised service.",
            years: 1,
            location: "Negombo",
        },
        {
            name: "Thisara Ayurvedic Spa",
            image: "./assets/images/partners/thisara-ayurvedic.jpg",
            description:
                "A luxury villa and Ayurvedic wellness retreat offering tranquil pool-side living and holistic spa experiences.",
            years: 1,
            location: "Negombo",
        },
        {
            name: "Camelot Beach Hotel",
            image: "./assets/images/partners/camelot-hotel.jpg",
            description:
                "An upscale beachfront hotel featuring an Ayurvedic spa, beachfront pool, and multiple dining options.",
            years: 2,
            location: "Negombo",
        },
        {
            name: "Maple Leaf Hotel",
            image: "./assets/images/partners/maple-leaf.jpg",
            description:
                "A 3-star hotel near Negombo Beach offering indoor and outdoor pools, a restaurant, and comfortable rooms.",
            years: 1,
            location: "Negombo",
        },
    ],
};

// Process/How It Works Section Data
export interface ProcessStep {
    number: string;
    title: string;
    text: string;
    icon: IconType;
}

export const processSteps: ProcessStep[] = [
    {
        number: "01",
        title: "Book a pickup",
        text: "Tell us what needs cleaning.",
        icon: RiCalendarCheckLine,
    },
    {
        number: "02",
        title: "We collect",
        text: "Picked up right from your door.",
        icon: RiTruckLine,
    },
    {
        number: "03",
        title: "We clean",
        text: "Washed, ironed, perfected.",
        icon: RiSparklingLine,
    },
    {
        number: "04",
        title: "We deliver",
        text: "Back to you, fresh & ready.",
        icon: RiHomeSmileLine,
    },
];

export const processSection = {
    badge: "How It Works",
    title: {
        main: "Laundry in",
        highlight: "4 easy steps.",
    },
    description: "",
    info: {
        title: "Simple. Professional. Convenient.",
        subtitle: "We take care of your clothes.",
    },
};

// Why Love Laundry Section Data
export interface Feature {
    icon: IconType;
    title: string;
    description: string;
}

export const features: Feature[] = [
    {
        icon: RiTruckLine,
        title: "Doorstep Service",
        description:
            "We collect and deliver your laundry right to your doorstep.",
    },
    {
        icon: RiSparklingLine,
        title: "Professional Care",
        description:
            "Your clothes are handled with professional equipment and care.",
    },
    {
        icon: RiTimeLine,
        title: "Save Your Time",
        description:
            "Spend your time on what matters while we take care of your laundry.",
    },
    {
        icon: RiShieldCheckLine,
        title: "Trusted Service",
        description:
            "We treat every garment with the attention and care it deserves.",
    },
];

export const benefits: string[] = [
    "Professional cleaning",
    "Careful garment handling",
    "Convenient pickup & delivery",
    "Reliable customer service",
];

export const whyLoveLaundrySection = {
    badge: "Why Love Laundry",
    title: {
        main: "More than clean.",
        highlight: "It's care.",
    },
    description:
        "Professional care plus modern convenience — for busy families, professionals and businesses.",
    card: {
        title: "We care about every garment.",
        description:
            "Professional laundry that's convenient, reliable and genuinely cared for.",
        info: {
            title: "Freshness you can trust",
            subtitle: "Every order receives professional care.",
        },
    },
};

// Testimonials Section Data
export interface Testimonial {
    quote: string;
    name: string;
    location: string;
    service: string;
}

export const testimonials: Testimonial[] = [
    {
        quote:
            "Our hotel linen has never looked better — always on time, always spotless.",
        name: "Nadil Fernando",
        location: "Colombo",
        service: "Hotel Linen Service",
    },
    {
        quote:
            "Perfectly pressed shirts every week. My laundry day is completely gone.",
        name: "Dinuka Perera",
        location: "Dehiwala",
        service: "Wash & Fold",
    },
    {
        quote:
            "They handled my delicate dress with such care, it looked brand new.",
        name: "Amaya Wickramasinghe",
        location: "Nugegoda",
        service: "Dry Cleaning",
    },
];

export const testimonialsSection = {
    badge: "Testimonials",
    title: {
        main: "Loved by",
        highlight: "busy families.",
    },
    description: "Real reviews from real customers.",
};

// Contact Section Data
export const contactSection = {
    badge: {
        icon: RiSparklingLine,
        text: "Ready when you are",
    },
    title: "Give your laundry day back to yourself.",
    description: "Book a pickup and we'll handle the rest.",
    features: [
        "Professional care",
        "Doorstep pickup",
        "Easy delivery",
    ],
    buttons: {
        phone: {
            text: "Call Us",
            href: `tel:${companyInfo.phone}`,
        },
        whatsapp: {
            text: "WhatsApp Us",
            href: `https://wa.me/${companyInfo.whatsapp.replace(/\+/g, "")}`,
        },
    },
};

// Join With Us / Hiring Section Data
export interface JobOpening {
    title: string;
    type: string;
    description: string;
    icon: IconType;
}

export const jobOpenings: JobOpening[] = [
    {
        title: "Delivery Driver",
        type: "Full-Time",
        description:
            "Pick up and deliver laundry to customers across the district. Must have a valid license and reliable vehicle.",
        icon: RiTruckLine,
    },
    {
        title: "Machine Operator",
        type: "Full-Time",
        description:
            "Operate industrial washing and drying machines. Training provided for the right candidate.",
        icon: RiScales3Line,
    },
    {
        title: "Ironer / Presser",
        type: "Full-Time / Part-Time",
        description:
            "Press and finish garments to professional standards. Experience with commercial irons preferred.",
        icon: RiSparklingLine,
    },
    {
        title: "Collection Agent",
        type: "Part-Time",
        description:
            "Visit homes and hotels to collect laundry orders. Great communication skills needed.",
        icon: RiUserStarLine,
    },
];

export const hiringSection = {
    badge: "Join Our Team",
    title: {
        main: "Grow with",
        highlight: "Love Laundry.",
    },
    description:
        "We're building a team of passionate people who take pride in delivering quality. Join us and build a career you'll love.",
    perks: [
        { icon: RiMoneyRupeeCircleLine, text: "Competitive pay" },
        { icon: RiTeamLine, text: "Friendly team environment" },
        { icon: RiAwardLine, text: "Training & growth opportunities" },
        { icon: RiTimeLine, text: "Flexible schedules available" },
    ],
    cta: {
        text: "Apply via WhatsApp",
        href: `https://wa.me/${companyInfo.whatsapp.replace(/\+/g, "")}?text=${encodeURIComponent("Hi Love Laundry, I'm interested in joining your team!")}`,
    },
};
