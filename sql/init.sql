-- Hackathon Management System - Database Schema

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS Evaluates;
DROP TABLE IF EXISTS Creates;
DROP TABLE IF EXISTS Supports;
DROP TABLE IF EXISTS Registration;
DROP TABLE IF EXISTS Workshop;
DROP TABLE IF EXISTS Submission;
DROP TABLE IF EXISTS Sponsor;
DROP TABLE IF EXISTS HackathonEvent;
DROP TABLE IF EXISTS Venue;
DROP TABLE IF EXISTS Judge;
DROP TABLE IF EXISTS Participant;
DROP TABLE IF EXISTS Person;

-- Create Person table (superclass in IS-A hierarchy)
CREATE TABLE Person (
    person_id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50)
);

-- Create Participant table (IS-A Person - total, disjoint)
CREATE TABLE Participant (
    person_id INT PRIMARY KEY,
    registration_date DATE NOT NULL,
    t_shirt_size VARCHAR(10),
    dietary_restrictions VARCHAR(255),
    manager_id INT,
    FOREIGN KEY (person_id) REFERENCES Person(person_id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES Participant(person_id) ON DELETE SET NULL
);

-- Create Judge table (IS-A Person - total, disjoint)
CREATE TABLE Judge (
    person_id INT PRIMARY KEY,
    expertise_area VARCHAR(255),
    years_experience INT,
    organization VARCHAR(255),
    FOREIGN KEY (person_id) REFERENCES Person(person_id) ON DELETE CASCADE
);

-- Create Venue table
CREATE TABLE Venue (
    venue_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500) NOT NULL,
    capacity INT NOT NULL,
    facilities TEXT
);

-- Create HackathonEvent table
CREATE TABLE HackathonEvent (
    event_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    event_type VARCHAR(100),
    max_participants INT,
    venue_id INT,
    FOREIGN KEY (venue_id) REFERENCES Venue(venue_id) ON DELETE SET NULL
);

-- Create Sponsor table
CREATE TABLE Sponsor (
    sponsor_id INT PRIMARY KEY AUTO_INCREMENT,
    company_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    website VARCHAR(255),
    contribution_amount DECIMAL(12, 2)
);

-- Create Submission table
CREATE TABLE Submission (
    submission_id INT PRIMARY KEY AUTO_INCREMENT,
    project_name VARCHAR(255) NOT NULL,
    description TEXT,
    submission_time DATETIME NOT NULL,
    technology_stack VARCHAR(500),
    repository_url VARCHAR(500)
);

-- Create Workshop table (Weak Entity - depends on HackathonEvent)
CREATE TABLE Workshop (
    workshop_number INT,
    event_id INT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration INT,
    skill_level VARCHAR(50),
    max_attendees INT,
    PRIMARY KEY (workshop_number, event_id),
    FOREIGN KEY (event_id) REFERENCES HackathonEvent(event_id) ON DELETE CASCADE
);

-- Create Registration relationship (with attributes - between Participant and HackathonEvent)
CREATE TABLE Registration (
    person_id INT,
    event_id INT,
    registration_number VARCHAR(50) NOT NULL,
    registration_timestamp DATETIME NOT NULL,
    payment_status VARCHAR(50),
    ticket_type VARCHAR(50),
    PRIMARY KEY (person_id, event_id),
    FOREIGN KEY (person_id) REFERENCES Participant(person_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES HackathonEvent(event_id) ON DELETE CASCADE
);

-- Create Supports relationship (M:N between Sponsor and HackathonEvent)
CREATE TABLE Supports (
    sponsor_id INT,
    event_id INT,
    PRIMARY KEY (sponsor_id, event_id),
    FOREIGN KEY (sponsor_id) REFERENCES Sponsor(sponsor_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES HackathonEvent(event_id) ON DELETE CASCADE
);

-- Create Creates relationship (M:N between Participant and Submission)
CREATE TABLE Creates (
    person_id INT,
    submission_id INT,
    PRIMARY KEY (person_id, submission_id),
    FOREIGN KEY (person_id) REFERENCES Participant(person_id) ON DELETE CASCADE,
    FOREIGN KEY (submission_id) REFERENCES Submission(submission_id) ON DELETE CASCADE
);

-- Create Evaluates relationship (M:N between Judge and Submission with attributes)
CREATE TABLE Evaluates (
    person_id INT,
    submission_id INT,
    score DECIMAL(5, 2),
    feedback TEXT,
    PRIMARY KEY (person_id, submission_id),
    FOREIGN KEY (person_id) REFERENCES Judge(person_id) ON DELETE CASCADE,
    FOREIGN KEY (submission_id) REFERENCES Submission(submission_id) ON DELETE CASCADE
);
