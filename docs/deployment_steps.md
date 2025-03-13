# Deployment Steps for Amazon Connect Call Quality Monitoring Documentation

This guide outlines the steps to host the documentation website in an S3 bucket with CloudFront distribution.

## Prerequisites

- AWS CLI installed and configured with appropriate permissions
- Access to AWS Management Console
- The documentation files ready for deployment

## Step 1: Create an S3 Bucket

Create an S3 bucket named "amazon-connect-call-quality-monitoring-new-relic-docs" in the us-east-1 region:

```bash
aws s3api create-bucket \
  --bucket amazon-connect-call-quality-monitoring-new-relic-docs \
  --region us-east-1
```

## Step 2: Configure the S3 Bucket for Static Website Hosting

Enable static website hosting on the bucket and set index.html as the default document:

```bash
aws s3 website s3://amazon-connect-call-quality-monitoring-new-relic-docs \
  --index-document index.html
```

## Step 3: Set Bucket Policy for Public Read Access

Create a bucket policy file named `bucket-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::amazon-connect-call-quality-monitoring-new-relic-docs/*"
    }
  ]
}
```

Apply the bucket policy:

```bash
aws s3api put-bucket-policy \
  --bucket amazon-connect-call-quality-monitoring-new-relic-docs \
  --policy file://bucket-policy.json
```

## Step 4: Upload Website Content to S3

Upload all documentation files to the S3 bucket:

```bash
aws s3 sync . s3://amazon-connect-call-quality-monitoring-new-relic-docs \
  --exclude ".DS_Store" \
  --exclude "deployment_steps.md" \
  --exclude "bucket-policy.json"
```

## Step 5: Create CloudFront Origin Access Identity (OAI)

Create an Origin Access Identity for CloudFront:

```bash
aws cloudfront create-cloud-front-origin-access-identity \
  --cloud-front-origin-access-identity-config CallerReference=amazon-connect-docs-oai,Comment=OAI-for-docs
```

Note the ID from the response (format: E2QWRUHAPOMQZL) for use in the next steps.

## Step 6: Update S3 Bucket Policy for CloudFront OAI

Create an updated bucket policy file named `bucket-policy-cloudfront.json` (replace `[OAI-ID]` with the ID from the previous step):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFrontReadGetObject",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity [OAI-ID]"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::amazon-connect-call-quality-monitoring-new-relic-docs/*"
    }
  ]
}
```

Apply the updated bucket policy:

```bash
aws s3api put-bucket-policy \
  --bucket amazon-connect-call-quality-monitoring-new-relic-docs \
  --policy file://bucket-policy-cloudfront.json
```

## Step 7: Create CloudFront Distribution

Create a CloudFront distribution configuration file named `cloudfront-config.json` (replace `[OAI-ID]` with your OAI ID):

```json
{
  "CallerReference": "amazon-connect-docs-distribution",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-amazon-connect-call-quality-monitoring-new-relic-docs",
        "DomainName": "amazon-connect-call-quality-monitoring-new-relic-docs.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": "origin-access-identity/cloudfront/[OAI-ID]"
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-amazon-connect-call-quality-monitoring-new-relic-docs",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000,
    "Compress": true
  },
  "Comment": "CloudFront Distribution for Amazon Connect Call Quality Monitoring Documentation",
  "Enabled": true,
  "PriceClass": "PriceClass_100"
}
```

Create the CloudFront distribution:

```bash
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json
```

Note the domain name from the response (format: d1234abcdef8.cloudfront.net).

## Step 8: Wait for CloudFront Distribution Deployment

Check the status of your CloudFront distribution:

```bash
aws cloudfront get-distribution --id [DISTRIBUTION-ID]
```

Wait until the `Status` field shows `Deployed` (this can take 15-30 minutes).

## Step 9: Access Your Website

Once the CloudFront distribution is deployed, you can access your website at:

```
https://[CLOUDFRONT-DOMAIN]/index.html
```

Replace `[CLOUDFRONT-DOMAIN]` with your CloudFront distribution domain name.

## Additional Considerations

1. **HTTPS**: CloudFront provides HTTPS by default with its domain name.

2. **Custom Domain**: To use a custom domain, you'll need to:
   - Register a domain or use an existing one
   - Create an SSL certificate using AWS Certificate Manager
   - Add an alternate domain name to your CloudFront distribution
   - Create a DNS record pointing to your CloudFront distribution

3. **Cache Invalidation**: After updating content, you may need to invalidate the CloudFront cache:

   ```bash
   aws cloudfront create-invalidation \
     --distribution-id [DISTRIBUTION-ID] \
     --paths "/*"
   ```

4. **Cost Optimization**: Consider setting appropriate cache behaviors and TTLs to minimize origin requests.

5. **Security**: Regularly review your bucket and CloudFront policies to ensure they follow the principle of least privilege.