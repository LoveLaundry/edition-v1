// Location data for Love Laundry map
// Update coordinates with exact shop addresses when available

export interface Location {
    id: string;
    name: string;
    type: "laundry" | "shop";
    lat: number;
    lng: number;
    address: string;
    phone?: string;
    hours?: string;
}

export const mainLaundry: Location = {
    id: "main",
    name: "Love Laundry - Main Centre",
    type: "laundry",
    lat: 7.5758,
    lng: 79.7953,
    address: "Chilaw, Puttalam District, Sri Lanka",
    phone: "+94774200919",
    hours: "Mon - Sat: 8:00 AM - 6:00 PM",
};

export const shopLocations: Location[] = [
    {
        id: "shop-madampe",
        name: "Love Laundry - Madampe",
        type: "shop",
        lat: 7.4979,
        lng: 79.8381,
        address: "Madampe, Puttalam District",
    },
    {
        id: "shop-mahawewa",
        name: "Love Laundry - Mahawewa",
        type: "shop",
        lat: 7.5139,
        lng: 79.9207,
        address: "Mahawewa, Puttalam District",
    },
    {
        id: "shop-kottaramulla",
        name: "Love Laundry - Kottaramulla",
        type: "shop",
        lat: 7.382,
        lng: 79.8749,
        address: "Kottaramulla, Puttalam District",
    },
    {
        id: "shop-dunakadeniya",
        name: "Love Laundry - Dunakadeniya",
        type: "shop",
        lat: 7.365,
        lng: 79.855,
        address: "Dunakadeniya, Puttalam District",
    },
    {
        id: "shop-bibiladeniya",
        name: "Love Laundry - Bibiladeniya",
        type: "shop",
        lat: 7.4529,
        lng: 79.9435,
        address: "Bibiladeniya, Puttalam District",
    },
    {
        id: "shop-wennappuwa",
        name: "Love Laundry - Wennappuwa",
        type: "shop",
        lat: 7.3467,
        lng: 79.8367,
        address: "Wennappuwa, Puttalam District",
    },
];

export const allLocations: Location[] = [mainLaundry, ...shopLocations];
