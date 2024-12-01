const OpenAI = require('openai');
const axios = require('axios');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function searchFacebookJobs(req, res) {
  try {
    const { location, jobType } = req.query;
    
    const searchResults = await searchWeb(`facebook groups developers jobs in tel aviv`);
    const analysis = await analyzeWithChatGPT(searchResults);
    
    res.json({ results: analysis });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search jobs' });
  }
}

async function searchWeb(query) {
  try {
    console.log('Search query:', query);
    console.log('API Key exists:', !!process.env.GOOGLE_API_KEY);
    console.log('Search Engine ID exists:', !!process.env.GOOGLE_SEARCH_ENGINE_ID);

    const url = 'https://www.googleapis.com/customsearch/v1';
    const params = {
      key: process.env.GOOGLE_API_KEY,
      cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
      q: query,
      num: 10
    };

    console.log('Request URL:', url);
    console.log('Request params:', { ...params, key: '[REDACTED]' });

    const response = await axios.get(url, { params });
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));

    return response.data.items || [];
  } catch (error) {
    console.error('Full error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: {
        ...error.config,
        params: { ...error.config?.params, key: '[REDACTED]' }
      }
    });
    throw new Error(`Search failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

async function searchFacebookJobs(req, res) {
  try {
    const { location = '', jobType = '' } = req.query;
    const query = `site:facebook.com/groups developers jobs in tel aviv`;
    
    const searchResults = await searchWeb(query);
    if (searchResults.length === 0) {
      return res.json({ results: [] });
    }

    const analysis = await analyzeWithChatGPT(searchResults);
    res.json({ results: analysis });
  } catch (error) {
    console.error('Search job error:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
async function analyzeWithChatGPT(searchResults) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "Extract and summarize job opportunities from these Facebook groups"
      },
      {
        role: "user", 
        content: JSON.stringify(searchResults)
      }
    ]
  });
  
  return completion.choices[0].message.content;
}

// Integration with existing job routes
async function searchAndCreateJob(req, res) {
  try {
    const { location, jobType } = req.body;
    
    // Search for similar jobs
    const searchResults = await searchWeb(`${jobType} jobs ${location}`);
    const analysis = await analyzeWithChatGPT(searchResults);
    
    // Create job listing
    const jobData = {
      title: req.body.title,
      description: `${req.body.description}\n\nMarket Analysis:\n${analysis}`,
      location: location,
      workType: jobType,
      employmentType: req.body.employmentType,
      requiredSkills: req.body.requiredSkills,
      niceToHaveSkills: req.body.niceToHaveSkills,
      status: 'active'
    };

    const result = await jobService.createJob(jobData, req.user.organizationId);
    res.status(201).json(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  searchFacebookJobs,
  searchAndCreateJob
};